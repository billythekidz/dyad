/**
 * Memory Tier Manager
 *
 * Manages the assignment of memory tiers to messages in the Neural Memory-First Architecture.
 *
 * Memory Tiers:
 * - `active`: Last 30 messages sent to Claude (full context window)
 * - `session`: Messages 31-200 (queryable via semantic search)
 * - `archived`: Messages 201+ (stored in nmem only, not in active context)
 *
 * @module memory_tier_manager
 */

import { db } from "../db";
import { messages, chatMemoryConfig } from "../db/schema";
import { eq, desc, asc } from "drizzle-orm";
import log from "electron-log";

const logger = log.scope("memory_tier_manager");

// Tier configuration
const TIER_CONFIG = {
  ACTIVE_THRESHOLD: 30, // Last 30 messages
  SESSION_THRESHOLD: 200, // Messages 31-200
  // Messages 201+ are archived
} as const;

/**
 * Update memory tiers for all messages in a chat
 *
 * Assigns messages to tiers based on recency:
 * - Last 30 messages → active
 * - Messages 31-200 → session
 * - Messages 201+ → archived
 *
 * @param chatId - Chat ID to update
 * @returns Number of messages updated per tier
 *
 * @example
 * ```ts
 * const result = await updateMemoryTiers(42);
 * console.log(`Updated: ${result.active} active, ${result.session} session, ${result.archived} archived`);
 * ```
 */
export async function updateMemoryTiers(chatId: number): Promise<{
  active: number;
  session: number;
  archived: number;
}> {
  try {
    logger.info(`[updateMemoryTiers] Starting tier update for chat ${chatId}`);

    // Fetch all messages for the chat, ordered by creation time (newest first)
    const allMessages = await db
      .select({
        id: messages.id,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(desc(messages.createdAt));

    if (allMessages.length === 0) {
      logger.warn(
        `[updateMemoryTiers] No messages found for chat ${chatId}`,
      );
      return { active: 0, session: 0, archived: 0 };
    }

    logger.info(
      `[updateMemoryTiers] Processing ${allMessages.length} messages`,
    );

    let activeCount = 0;
    let sessionCount = 0;
    let archivedCount = 0;

    // Process messages in batches for efficiency
    const batchSize = 50;
    for (let i = 0; i < allMessages.length; i += batchSize) {
      const batch = allMessages.slice(i, i + batchSize);

      for (let j = 0; j < batch.length; j++) {
        const message = batch[j];
        const position = i + j; // Position from newest (0 = newest)

        let newTier: "active" | "session" | "archived";

        if (position < TIER_CONFIG.ACTIVE_THRESHOLD) {
          newTier = "active";
          activeCount++;
        } else if (position < TIER_CONFIG.SESSION_THRESHOLD) {
          newTier = "session";
          sessionCount++;
        } else {
          newTier = "archived";
          archivedCount++;
        }

        // Update the tier for this message
        await db
          .update(messages)
          .set({ memoryTier: newTier })
          .where(eq(messages.id, message.id));
      }
    }

    // Update chat memory config with total message count
    await ensureChatMemoryConfig(chatId, allMessages.length);

    logger.info(
      `[updateMemoryTiers] Updated chat ${chatId}: ${activeCount} active, ${sessionCount} session, ${archivedCount} archived`,
    );

    return {
      active: activeCount,
      session: sessionCount,
      archived: archivedCount,
    };
  } catch (error) {
    logger.error(
      `[updateMemoryTiers] Failed to update tiers for chat ${chatId}:`,
      error,
    );
    throw error;
  }
}

/**
 * Ensure chat memory config exists and is up to date
 *
 * @param chatId - Chat ID
 * @param totalMessages - Total message count
 */
async function ensureChatMemoryConfig(
  chatId: number,
  totalMessages: number,
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
        totalMessages,
        activeWindowSize: TIER_CONFIG.ACTIVE_THRESHOLD,
        activeWindowTokenBudget: 40000,
      });
      logger.info(`[ensureChatMemoryConfig] Created config for chat ${chatId}`);
    } else {
      // Update existing config
      await db
        .update(chatMemoryConfig)
        .set({
          totalMessages,
          updatedAt: new Date(),
        })
        .where(eq(chatMemoryConfig.chatId, chatId));
    }
  } catch (error) {
    logger.error(
      `[ensureChatMemoryConfig] Failed to ensure config for chat ${chatId}:`,
      error,
    );
    // Don't throw - this is not critical
  }
}

/**
 * Update tiers for a single newly added message
 *
 * More efficient than full tier update when adding a single message.
 * Sets the new message to 'active' and potentially demotes older messages.
 *
 * @param chatId - Chat ID
 * @param messageId - Newly added message ID
 * @returns true if update succeeded
 *
 * @example
 * ```ts
 * await updateTiersForNewMessage(42, 1337);
 * ```
 */
export async function updateTiersForNewMessage(
  chatId: number,
  messageId: number,
): Promise<boolean> {
  try {
    logger.info(
      `[updateTiersForNewMessage] Quick tier update for chat ${chatId}, message ${messageId}`,
    );

    // Set the new message to active
    await db
      .update(messages)
      .set({ memoryTier: "active" })
      .where(eq(messages.id, messageId));

    // Get message count
    const messageCount = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.chatId, chatId));

    const totalMessages = messageCount.length;

    // Only do full tier update if we've crossed a threshold
    if (
      totalMessages === TIER_CONFIG.ACTIVE_THRESHOLD + 1 ||
      totalMessages === TIER_CONFIG.SESSION_THRESHOLD + 1 ||
      totalMessages % 50 === 0 // Periodic full update every 50 messages
    ) {
      logger.info(
        `[updateTiersForNewMessage] Threshold crossed, doing full tier update`,
      );
      await updateMemoryTiers(chatId);
    }

    return true;
  } catch (error) {
    logger.error(
      `[updateTiersForNewMessage] Failed to update tiers:`,
      error,
    );
    return false;
  }
}

/**
 * Get current tier statistics for a chat
 *
 * @param chatId - Chat ID
 * @returns Tier counts
 *
 * @example
 * ```ts
 * const stats = await getTierStats(42);
 * console.log(`Active: ${stats.active}, Session: ${stats.session}`);
 * ```
 */
export async function getTierStats(chatId: number): Promise<{
  active: number;
  session: number;
  archived: number;
  total: number;
}> {
  try {
    const allMessages = await db
      .select({
        memoryTier: messages.memoryTier,
      })
      .from(messages)
      .where(eq(messages.chatId, chatId));

    const stats = {
      active: 0,
      session: 0,
      archived: 0,
      total: allMessages.length,
    };

    for (const msg of allMessages) {
      if (msg.memoryTier === "active") stats.active++;
      else if (msg.memoryTier === "session") stats.session++;
      else if (msg.memoryTier === "archived") stats.archived++;
    }

    return stats;
  } catch (error) {
    logger.error(`[getTierStats] Failed to get stats for chat ${chatId}:`, error);
    return { active: 0, session: 0, archived: 0, total: 0 };
  }
}
