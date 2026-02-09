/**
 * Dynamic Window Sizing
 *
 * Automatically adjusts the active window size based on message length
 * to stay within token budget while maximizing context.
 *
 * Algorithm:
 * - Calculate average tokens per message
 * - Determine optimal window size: min(50, floor(budget / avgTokens))
 * - Update chat_memory_config
 *
 * @module dynamic_window_sizing
 */

import { db } from "../db";
import { messages, chatMemoryConfig } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import log from "electron-log";
import { updateMemoryTiers } from "./memory_tier_manager";

const logger = log.scope("dynamic_window_sizing");

// Configuration
const CONFIG = {
  DEFAULT_TOKEN_BUDGET: 40000, // 40k tokens for active window
  MAX_WINDOW_SIZE: 50, // Never exceed 50 messages
  MIN_WINDOW_SIZE: 10, // Always keep at least 10 messages
  UPDATE_FREQUENCY: 10, // Recalculate every N messages
  CHARS_PER_TOKEN: 4, // Rough estimate for token calculation
} as const;

/**
 * Calculate optimal active window size for a chat
 *
 * Analyzes message length to determine how many messages can fit
 * in the token budget while maximizing context.
 *
 * @param chatId - Chat ID
 * @returns New window size
 *
 * @example
 * ```ts
 * const newSize = await calculateOptimalWindowSize(42);
 * console.log(`Optimal window size: ${newSize} messages`);
 * ```
 */
export async function calculateOptimalWindowSize(
  chatId: number
): Promise<number> {
  try {
    logger.info(
      `[calculateOptimalWindowSize] Calculating for chat ${chatId}`
    );

    // Get recent messages to analyze (last 100 for statistical significance)
    const recentMessages = await db
      .select({
        content: messages.content,
        estimatedTokens: messages.estimatedTokens,
      })
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(sql`${messages.createdAt} DESC`)
      .limit(100);

    if (recentMessages.length === 0) {
      logger.warn(
        `[calculateOptimalWindowSize] No messages found for chat ${chatId}`
      );
      return CONFIG.MIN_WINDOW_SIZE;
    }

    // Calculate average tokens per message
    let totalTokens = 0;
    for (const msg of recentMessages) {
      if (msg.estimatedTokens) {
        totalTokens += msg.estimatedTokens;
      } else {
        // Fallback estimate
        totalTokens += Math.ceil(msg.content.length / CONFIG.CHARS_PER_TOKEN);
      }
    }

    const avgTokensPerMessage = totalTokens / recentMessages.length;

    logger.info(
      `[calculateOptimalWindowSize] Average tokens per message: ${avgTokensPerMessage.toFixed(0)}`
    );

    // Get token budget from config or use default
    const config = await getChatMemoryConfig(chatId);
    const tokenBudget = config?.activeWindowTokenBudget || CONFIG.DEFAULT_TOKEN_BUDGET;

    // Calculate optimal window size: min(50, floor(budget / avgTokens))
    const calculatedSize = Math.floor(tokenBudget / avgTokensPerMessage);
    const optimalSize = Math.min(
      CONFIG.MAX_WINDOW_SIZE,
      Math.max(CONFIG.MIN_WINDOW_SIZE, calculatedSize)
    );

    logger.info(
      `[calculateOptimalWindowSize] Optimal size: ${optimalSize} messages (budget: ${tokenBudget}, avg tokens: ${avgTokensPerMessage.toFixed(0)})`
    );

    // Update the config
    await updateActiveWindowSize(chatId, optimalSize);

    return optimalSize;
  } catch (error) {
    logger.error(
      `[calculateOptimalWindowSize] Failed for chat ${chatId}:`,
      error
    );
    return CONFIG.MIN_WINDOW_SIZE;
  }
}

/**
 * Update active window size in chat memory config
 *
 * @param chatId - Chat ID
 * @param windowSize - New window size
 */
async function updateActiveWindowSize(
  chatId: number,
  windowSize: number
): Promise<void> {
  try {
    // Check if config exists
    const existingConfig = await db
      .select()
      .from(chatMemoryConfig)
      .where(eq(chatMemoryConfig.chatId, chatId))
      .limit(1);

    if (existingConfig.length === 0) {
      // Create new config
      await db.insert(chatMemoryConfig).values({
        chatId,
        activeWindowSize: windowSize,
        activeWindowTokenBudget: CONFIG.DEFAULT_TOKEN_BUDGET,
        totalMessages: 0,
      });
      logger.info(
        `[updateActiveWindowSize] Created config for chat ${chatId} with window size ${windowSize}`
      );
    } else {
      // Update existing config
      await db
        .update(chatMemoryConfig)
        .set({
          activeWindowSize: windowSize,
          updatedAt: new Date(),
        })
        .where(eq(chatMemoryConfig.chatId, chatId));

      logger.info(
        `[updateActiveWindowSize] Updated window size to ${windowSize} for chat ${chatId}`
      );
    }

    // After changing window size, update tiers to reflect new boundaries
    await updateMemoryTiers(chatId);
  } catch (error) {
    logger.error(
      `[updateActiveWindowSize] Failed to update window size:`,
      error
    );
  }
}

/**
 * Check if window size should be recalculated
 *
 * Returns true every N messages (based on UPDATE_FREQUENCY)
 *
 * @param chatId - Chat ID
 * @returns true if recalculation is needed
 */
export async function shouldRecalculateWindowSize(
  chatId: number
): Promise<boolean> {
  try {
    const config = await getChatMemoryConfig(chatId);

    if (!config) {
      // No config yet, should calculate
      return true;
    }

    // Get current message count
    const messageCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.chatId, chatId));

    const totalMessages = Number(messageCount[0]?.count || 0);

    // Recalculate every UPDATE_FREQUENCY messages
    return totalMessages % CONFIG.UPDATE_FREQUENCY === 0;
  } catch (error) {
    logger.error(
      `[shouldRecalculateWindowSize] Error checking for chat ${chatId}:`,
      error
    );
    return false;
  }
}

/**
 * Auto-adjust window size after adding a new message
 *
 * Call this after inserting a new message. It will check if recalculation
 * is needed based on message count.
 *
 * @param chatId - Chat ID
 * @returns New window size if recalculated, null otherwise
 *
 * @example
 * ```ts
 * await autoAdjustWindowSize(42);
 * ```
 */
export async function autoAdjustWindowSize(
  chatId: number
): Promise<number | null> {
  try {
    if (await shouldRecalculateWindowSize(chatId)) {
      logger.info(
        `[autoAdjustWindowSize] Triggering recalculation for chat ${chatId}`
      );
      const newSize = await calculateOptimalWindowSize(chatId);
      return newSize;
    }
    return null;
  } catch (error) {
    logger.error(
      `[autoAdjustWindowSize] Failed for chat ${chatId}:`,
      error
    );
    return null;
  }
}

/**
 * Get memory configuration for a chat
 *
 * @param chatId - Chat ID
 * @returns Memory configuration or null
 */
async function getChatMemoryConfig(chatId: number) {
  try {
    const config = await db
      .select()
      .from(chatMemoryConfig)
      .where(eq(chatMemoryConfig.chatId, chatId))
      .limit(1);

    return config[0] || null;
  } catch (error) {
    logger.error(
      `[getChatMemoryConfig] Failed to get config for chat ${chatId}:`,
      error
    );
    return null;
  }
}

/**
 * Set custom token budget for a chat
 *
 * Allows manual override of the default 40k token budget.
 *
 * @param chatId - Chat ID
 * @param budget - Token budget
 *
 * @example
 * ```ts
 * await setTokenBudget(42, 60000); // Increase to 60k tokens
 * ```
 */
export async function setTokenBudget(
  chatId: number,
  budget: number
): Promise<void> {
  try {
    const config = await getChatMemoryConfig(chatId);

    if (config) {
      await db
        .update(chatMemoryConfig)
        .set({
          activeWindowTokenBudget: budget,
          updatedAt: new Date(),
        })
        .where(eq(chatMemoryConfig.chatId, chatId));

      logger.info(
        `[setTokenBudget] Updated budget to ${budget} for chat ${chatId}`
      );

      // Recalculate window size with new budget
      await calculateOptimalWindowSize(chatId);
    } else {
      // Create config with custom budget
      await db.insert(chatMemoryConfig).values({
        chatId,
        activeWindowTokenBudget: budget,
        activeWindowSize: CONFIG.MIN_WINDOW_SIZE,
        totalMessages: 0,
      });

      logger.info(
        `[setTokenBudget] Created config with budget ${budget} for chat ${chatId}`
      );
    }
  } catch (error) {
    logger.error(`[setTokenBudget] Failed for chat ${chatId}:`, error);
  }
}
