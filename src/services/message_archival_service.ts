/**
 * Message Archival Service
 *
 * Handles archiving of old messages for long conversations (500+ messages).
 * Keeps summaries in SQLite, archives full messages to nmem and disk.
 *
 * Strategy:
 * - Keep last 50 active messages in SQLite
 * - Archive older summarized messages to disk
 * - All messages remain in nmem for semantic recall
 * - Summaries stay in SQLite for context assembly
 *
 * @module message_archival_service
 */

import log from "electron-log";
import { db } from "../db";
import { messages, chatMemoryConfig, conversationSummaries } from "../db/schema";
import { eq, and, lt, isNotNull, asc } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import * as path from "path";
import { getDyadAppPath } from "../paths/paths";

const logger = log.scope("message_archival");

// Configuration
const ARCHIVAL_CONFIG = {
  ACTIVE_MESSAGE_LIMIT: 50, // Keep last 50 messages active
  TRIGGER_THRESHOLD: 500, // Archive when conversation reaches 500 messages
  ARCHIVE_BATCH_SIZE: 100, // Archive 100 messages at a time
} as const;

/**
 * Check if archival is needed for a chat
 *
 * @param chatId - Chat ID
 * @returns true if archival should be triggered
 */
export async function shouldArchive(chatId: number): Promise<boolean> {
  try {
    const config = await db
      .select()
      .from(chatMemoryConfig)
      .where(eq(chatMemoryConfig.chatId, chatId))
      .limit(1);

    if (!config || config.length === 0) {
      return false;
    }

    const { totalMessages } = config[0];

    // Trigger archival when conversation reaches threshold
    const shouldTrigger = totalMessages >= ARCHIVAL_CONFIG.TRIGGER_THRESHOLD;

    if (shouldTrigger) {
      logger.info(
        `[shouldArchive] Archival needed for chat ${chatId} (${totalMessages} messages)`
      );
    }

    return shouldTrigger;
  } catch (error) {
    logger.error("[shouldArchive] Error checking archival need:", error);
    return false;
  }
}

/**
 * Get messages eligible for archival
 *
 * Returns messages that:
 * - Are in 'archived' tier
 * - Have a summaryId (have been summarized)
 * - Are not in the last 50 messages
 *
 * @param chatId - Chat ID
 * @returns Array of archivable messages
 */
export async function getArchivableMessages(chatId: number) {
  try {
    // Get total message count
    const allMessages = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.id));

    if (allMessages.length <= ARCHIVAL_CONFIG.ACTIVE_MESSAGE_LIMIT) {
      logger.info(
        `[getArchivableMessages] Not enough messages to archive (${allMessages.length} messages)`
      );
      return [];
    }

    // Get messages eligible for archival (all except last 50)
    const cutoffId = allMessages[allMessages.length - ARCHIVAL_CONFIG.ACTIVE_MESSAGE_LIMIT].id;

    const archivableMessages = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
        summaryId: messages.summaryId,
        memoryTier: messages.memoryTier,
      })
      .from(messages)
      .where(
        and(
          eq(messages.chatId, chatId),
          lt(messages.id, cutoffId),
          eq(messages.memoryTier, "archived"),
          isNotNull(messages.summaryId)
        )
      )
      .orderBy(asc(messages.id))
      .limit(ARCHIVAL_CONFIG.ARCHIVE_BATCH_SIZE);

    logger.info(
      `[getArchivableMessages] Found ${archivableMessages.length} messages eligible for archival`
    );

    return archivableMessages;
  } catch (error) {
    logger.error("[getArchivableMessages] Error getting archivable messages:", error);
    return [];
  }
}

/**
 * Archive messages to disk
 *
 * Exports messages to JSON file in the app's userData directory.
 *
 * @param chatId - Chat ID
 * @param messagesToArchive - Messages to archive
 * @returns Path to archive file or null
 */
export async function archiveMessagesToDisk(
  chatId: number,
  messagesToArchive: any[]
): Promise<string | null> {
  try {
    if (messagesToArchive.length === 0) {
      logger.info("[archiveMessagesToDisk] No messages to archive");
      return null;
    }

    // Create archives directory in userData
    const appDataPath = getDyadAppPath("");
    const archivesDir = path.join(appDataPath, "archives");

    // Create directory if it doesn't exist
    await mkdir(archivesDir, { recursive: true });

    // Generate archive filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archiveFilename = `chat-${chatId}-archive-${timestamp}.json`;
    const archivePath = path.join(archivesDir, archiveFilename);

    // Prepare archive data
    const archiveData = {
      chatId,
      archivedAt: new Date().toISOString(),
      messageCount: messagesToArchive.length,
      messageRange: {
        startId: messagesToArchive[0].id,
        endId: messagesToArchive[messagesToArchive.length - 1].id,
      },
      messages: messagesToArchive,
    };

    // Write to file
    await writeFile(archivePath, JSON.stringify(archiveData, null, 2), "utf-8");

    logger.info(
      `[archiveMessagesToDisk] Archived ${messagesToArchive.length} messages to ${archivePath}`
    );

    return archivePath;
  } catch (error) {
    logger.error("[archiveMessagesToDisk] Error archiving messages to disk:", error);
    return null;
  }
}

/**
 * Delete archived messages from SQLite
 *
 * Removes messages that have been successfully archived to disk.
 * Summaries remain in the database.
 *
 * @param messageIds - Array of message IDs to delete
 * @returns Number of messages deleted
 */
export async function deleteArchivedMessages(
  messageIds: number[]
): Promise<number> {
  try {
    if (messageIds.length === 0) {
      return 0;
    }

    // Delete messages from database
    const result = await db
      .delete(messages)
      .where(
        and(
          ...messageIds.map((id) => eq(messages.id, id))
        )
      );

    logger.info(`[deleteArchivedMessages] Deleted ${messageIds.length} archived messages from SQLite`);

    return messageIds.length;
  } catch (error) {
    logger.error("[deleteArchivedMessages] Error deleting archived messages:", error);
    return 0;
  }
}

/**
 * Perform archival for a chat
 *
 * Main entry point for archival process:
 * 1. Find messages eligible for archival
 * 2. Export to disk
 * 3. Delete from SQLite (keep in nmem)
 * 4. Summaries remain in SQLite
 *
 * @param chatId - Chat ID
 * @returns Archival result
 *
 * @example
 * ```ts
 * const result = await performArchival(42);
 * console.log(`Archived ${result.archivedCount} messages`);
 * ```
 */
export async function performArchival(chatId: number): Promise<{
  success: boolean;
  archivedCount: number;
  archivePath: string | null;
  error?: string;
}> {
  try {
    logger.info(`[performArchival] Starting archival process for chat ${chatId}`);

    // Check if archival is needed
    const needed = await shouldArchive(chatId);
    if (!needed) {
      logger.info(`[performArchival] Archival not needed for chat ${chatId}`);
      return {
        success: true,
        archivedCount: 0,
        archivePath: null,
      };
    }

    // Get messages to archive
    const messagesToArchive = await getArchivableMessages(chatId);
    if (messagesToArchive.length === 0) {
      logger.info(`[performArchival] No eligible messages for archival`);
      return {
        success: true,
        archivedCount: 0,
        archivePath: null,
      };
    }

    // Archive to disk
    const archivePath = await archiveMessagesToDisk(chatId, messagesToArchive);
    if (!archivePath) {
      logger.error(`[performArchival] Failed to archive messages to disk`);
      return {
        success: false,
        archivedCount: 0,
        archivePath: null,
        error: "Failed to write archive file",
      };
    }

    // Delete from SQLite (messages stay in nmem for recall)
    const messageIds = messagesToArchive.map((msg) => msg.id);
    const deletedCount = await deleteArchivedMessages(messageIds);

    logger.info(
      `[performArchival] Archival completed successfully:` +
      ` ${deletedCount} messages archived to ${archivePath}`
    );

    return {
      success: true,
      archivedCount: deletedCount,
      archivePath,
    };
  } catch (error) {
    logger.error("[performArchival] Error during archival:", error);
    return {
      success: false,
      archivedCount: 0,
      archivePath: null,
      error: String(error),
    };
  }
}

/**
 * Get archival status for a chat
 *
 * @param chatId - Chat ID
 * @returns Archival statistics
 */
export async function getArchivalStatus(chatId: number): Promise<{
  totalMessages: number;
  activeMessages: number;
  archivedMessages: number;
  summaries: number;
}> {
  try {
    const config = await db
      .select()
      .from(chatMemoryConfig)
      .where(eq(chatMemoryConfig.chatId, chatId))
      .limit(1);

    const totalMessages = config[0]?.totalMessages || 0;

    // Count active messages in SQLite
    const activeMessages = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.chatId, chatId));

    // Count summaries
    const summaries = await db
      .select({ id: conversationSummaries.id })
      .from(conversationSummaries)
      .where(eq(conversationSummaries.chatId, chatId));

    return {
      totalMessages,
      activeMessages: activeMessages.length,
      archivedMessages: totalMessages - activeMessages.length,
      summaries: summaries.length,
    };
  } catch (error) {
    logger.error("[getArchivalStatus] Error getting archival status:", error);
    return {
      totalMessages: 0,
      activeMessages: 0,
      archivedMessages: 0,
      summaries: 0,
    };
  }
}
