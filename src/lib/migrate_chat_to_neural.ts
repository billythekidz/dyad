/**
 * Chat Migration to Neural Memory
 *
 * Migrates existing chats to the Neural Memory-First Architecture.
 *
 * Migration process:
 * 1. Assign memory tiers to all messages
 * 2. Create chat memory config
 * 3. Calculate optimal window size
 * 4. Queue messages for nmem sync (background)
 *
 * @module migrate_chat_to_neural
 */

import { db } from "../db";
import { chats, messages, chatMemoryConfig } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import log from "electron-log";
import { updateMemoryTiers } from "./memory_tier_manager";
import { calculateOptimalWindowSize } from "./dynamic_window_sizing";
import { queueMessageSync } from "../services/background_sync";
import type { ModelMessage } from "ai";

const logger = log.scope("migrate_chat_to_neural");

/**
 * Migration status tracking
 */
interface MigrationResult {
  success: boolean;
  chatId: number;
  messagesProcessed: number;
  tiersAssigned: boolean;
  configCreated: boolean;
  nmemQueued: boolean;
  error?: string;
}

/**
 * Migrate a single chat to neural memory architecture
 *
 * @param chatId - Chat ID to migrate
 * @param queueNmemSync - Whether to queue nmem sync (default: true)
 * @returns Migration result
 *
 * @example
 * ```ts
 * const result = await migrateChatToNeural(42);
 * if (result.success) {
 *   console.log(`Migrated ${result.messagesProcessed} messages`);
 * }
 * ```
 */
export async function migrateChatToNeural(
  chatId: number,
  queueNmemSync: boolean = true
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    chatId,
    messagesProcessed: 0,
    tiersAssigned: false,
    configCreated: false,
    nmemQueued: false,
  };

  try {
    logger.info(`[migrateChatToNeural] Starting migration for chat ${chatId}`);

    // Step 1: Get all messages for the chat
    const chatMessages = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        memoryTier: messages.memoryTier,
      })
      .from(messages)
      .where(eq(messages.chatId, chatId));

    if (chatMessages.length === 0) {
      logger.warn(
        `[migrateChatToNeural] No messages found for chat ${chatId}, skipping`
      );
      result.success = true; // Not an error, just nothing to migrate
      return result;
    }

    result.messagesProcessed = chatMessages.length;
    logger.info(
      `[migrateChatToNeural] Found ${chatMessages.length} messages to migrate`
    );

    // Step 2: Assign memory tiers to all messages
    const tierResult = await updateMemoryTiers(chatId);
    logger.info(
      `[migrateChatToNeural] Assigned tiers: ${tierResult.active} active, ${tierResult.session} session, ${tierResult.archived} archived`
    );
    result.tiersAssigned = true;

    // Step 3: Create or update chat memory config
    const existingConfig = await db
      .select()
      .from(chatMemoryConfig)
      .where(eq(chatMemoryConfig.chatId, chatId))
      .limit(1);

    if (existingConfig.length === 0) {
      // Calculate optimal window size
      const optimalSize = await calculateOptimalWindowSize(chatId);

      await db.insert(chatMemoryConfig).values({
        chatId,
        activeWindowSize: optimalSize,
        activeWindowTokenBudget: 40000,
        totalMessages: chatMessages.length,
      });

      logger.info(
        `[migrateChatToNeural] Created memory config with window size ${optimalSize}`
      );
    } else {
      // Update existing config
      await db
        .update(chatMemoryConfig)
        .set({
          totalMessages: chatMessages.length,
          updatedAt: new Date(),
        })
        .where(eq(chatMemoryConfig.chatId, chatId));

      logger.info(`[migrateChatToNeural] Updated existing memory config`);
    }

    result.configCreated = true;

    // Step 4: Queue messages for nmem sync (background, non-blocking)
    if (queueNmemSync) {
      try {
        // Only queue non-active messages for immediate sync
        // Active messages will be synced naturally as they're used
        const messagesToQueue = chatMessages.filter(
          (msg) => msg.memoryTier !== "active"
        );

        for (const msg of messagesToQueue) {
          // Queue in background - don't wait
          queueMessageSync(
            chatId,
            msg.id,
            {
              role: msg.role as "user" | "assistant",
              content: msg.content,
            } as ModelMessage
          ).catch((err) => {
            logger.warn(
              `[migrateChatToNeural] Failed to queue message ${msg.id}:`,
              err
            );
          });
        }

        logger.info(
          `[migrateChatToNeural] Queued ${messagesToQueue.length} messages for nmem sync`
        );
        result.nmemQueued = true;
      } catch (error) {
        logger.error(
          `[migrateChatToNeural] Failed to queue nmem sync:`,
          error
        );
        // Don't fail migration if nmem queue fails
      }
    }

    result.success = true;
    logger.info(`[migrateChatToNeural] Successfully migrated chat ${chatId}`);

    return result;
  } catch (error) {
    logger.error(
      `[migrateChatToNeural] Migration failed for chat ${chatId}:`,
      error
    );
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

/**
 * Check if a chat has been migrated to neural memory
 *
 * A chat is considered migrated if:
 * - It has a chat_memory_config entry
 * - Messages have assigned memory tiers
 *
 * @param chatId - Chat ID
 * @returns true if migrated
 */
export async function isChatMigrated(chatId: number): Promise<boolean> {
  try {
    // Check if config exists
    const config = await db
      .select()
      .from(chatMemoryConfig)
      .where(eq(chatMemoryConfig.chatId, chatId))
      .limit(1);

    if (config.length === 0) {
      return false;
    }

    // Check if messages have tiers assigned
    const messagesWithTiers = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.chatId, chatId));

    const totalMessages = Number(messagesWithTiers[0]?.count || 0);

    // If there are messages, they should have tiers
    if (totalMessages > 0) {
      // Check if any message has a non-default tier
      const activeTierMessages = await db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(eq(messages.chatId, chatId));

      const hasAssignedTiers = Number(activeTierMessages[0]?.count || 0) > 0;
      return hasAssignedTiers;
    }

    // No messages = migrated (nothing to migrate)
    return true;
  } catch (error) {
    logger.error(
      `[isChatMigrated] Error checking migration status for chat ${chatId}:`,
      error
    );
    return false;
  }
}

/**
 * Migrate all unmigrated chats in the database
 *
 * WARNING: This can be slow for large databases.
 * Use with caution or run in background.
 *
 * @param limit - Maximum number of chats to migrate (default: 10)
 * @returns Array of migration results
 *
 * @example
 * ```ts
 * const results = await migrateAllChats(5);
 * console.log(`Migrated ${results.filter(r => r.success).length} chats`);
 * ```
 */
export async function migrateAllChats(
  limit: number = 10
): Promise<MigrationResult[]> {
  try {
    logger.info(`[migrateAllChats] Starting batch migration (limit: ${limit})`);

    // Get all chats
    const allChats = await db
      .select({ id: chats.id })
      .from(chats)
      .limit(limit);

    logger.info(`[migrateAllChats] Found ${allChats.length} chats`);

    const results: MigrationResult[] = [];

    for (const chat of allChats) {
      // Check if already migrated
      const migrated = await isChatMigrated(chat.id);

      if (migrated) {
        logger.info(
          `[migrateAllChats] Chat ${chat.id} already migrated, skipping`
        );
        continue;
      }

      // Migrate the chat
      const result = await migrateChatToNeural(chat.id);
      results.push(result);

      // Log progress
      logger.info(
        `[migrateAllChats] Progress: ${results.length}/${allChats.length}`
      );
    }

    const successful = results.filter((r) => r.success).length;
    logger.info(
      `[migrateAllChats] Completed: ${successful}/${results.length} successful`
    );

    return results;
  } catch (error) {
    logger.error(`[migrateAllChats] Batch migration failed:`, error);
    return [];
  }
}

/**
 * Migrate a chat when it's opened (lazy migration)
 *
 * This is the recommended approach - migrate chats on-demand
 * when users actually open them.
 *
 * @param chatId - Chat ID
 * @returns true if migration succeeded or chat was already migrated
 *
 * @example
 * ```ts
 * // In chat open handler:
 * await migrateChatOnOpen(42);
 * ```
 */
export async function migrateChatOnOpen(chatId: number): Promise<boolean> {
  try {
    // Check if already migrated
    const migrated = await isChatMigrated(chatId);

    if (migrated) {
      logger.info(`[migrateChatOnOpen] Chat ${chatId} already migrated`);
      return true;
    }

    logger.info(`[migrateChatOnOpen] Migrating chat ${chatId} on demand`);

    // Migrate the chat
    const result = await migrateChatToNeural(chatId);

    if (!result.success) {
      logger.error(
        `[migrateChatOnOpen] Migration failed for chat ${chatId}:`,
        result.error
      );
      return false;
    }

    logger.info(`[migrateChatOnOpen] Successfully migrated chat ${chatId}`);
    return true;
  } catch (error) {
    logger.error(
      `[migrateChatOnOpen] Error migrating chat ${chatId}:`,
      error
    );
    return false;
  }
}

/**
 * Get migration statistics
 *
 * @returns Statistics about migration progress
 */
export async function getMigrationStats(): Promise<{
  totalChats: number;
  migratedChats: number;
  unmigratedChats: number;
  percentComplete: number;
}> {
  try {
    // Get total chats
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(chats);

    const totalChats = Number(totalResult[0]?.count || 0);

    // Get migrated chats (those with memory config)
    const migratedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMemoryConfig);

    const migratedChats = Number(migratedResult[0]?.count || 0);

    const unmigratedChats = totalChats - migratedChats;
    const percentComplete =
      totalChats > 0 ? (migratedChats / totalChats) * 100 : 100;

    return {
      totalChats,
      migratedChats,
      unmigratedChats,
      percentComplete,
    };
  } catch (error) {
    logger.error(`[getMigrationStats] Failed to get stats:`, error);
    return {
      totalChats: 0,
      migratedChats: 0,
      unmigratedChats: 0,
      percentComplete: 0,
    };
  }
}
