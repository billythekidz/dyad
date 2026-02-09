/**
 * Background Sync Service for Neural Memory
 *
 * Handles asynchronous syncing of messages to neural memory without blocking the UI.
 *
 * Features:
 * - In-memory queue with SQLite persistence
 * - Automatic flush every 5 seconds OR when 10 items queued
 * - Retry logic for failed operations
 * - Graceful shutdown with queue flush
 *
 * @module background_sync
 */

import log from "electron-log";
import type { ModelMessage } from "ai";
import { db } from "../db";
import { nmemSyncQueue } from "../db/schema";
import { eq, and, lt } from "drizzle-orm";
import * as nmemService from "../lib/nmem_service";

const logger = log.scope("background_sync");

// Configuration
const SYNC_CONFIG = {
  FLUSH_INTERVAL: 5000, // 5 seconds
  BATCH_SIZE: 10, // Flush when queue reaches this size
  MAX_RETRIES: 3,
  RETRY_BACKOFF: 5000, // 5 seconds between retries
} as const;

// Queue item types
interface QueueItem {
  id?: number; // DB ID if persisted
  chatId: number;
  messageId: number;
  operation: "save_message" | "save_summary";
  payload: SaveMessagePayload | SaveSummaryPayload;
  attempts: number;
  createdAt: number;
}

interface SaveMessagePayload {
  message: ModelMessage;
}

interface SaveSummaryPayload {
  summary: string;
  messageRange: { start: number; end: number };
}

/**
 * Background Sync Queue Manager
 */
class BackgroundSyncService {
  private queue: QueueItem[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isShuttingDown = false;

  constructor() {
    logger.info("[BackgroundSync] Initializing background sync service");
    this.startFlushTimer();
    this.loadPersistedQueue();
  }

  /**
   * Start the periodic flush timer
   */
  private startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (!this.isProcessing && this.queue.length > 0) {
        this.flush();
      }
    }, SYNC_CONFIG.FLUSH_INTERVAL);

    logger.info(
      `[BackgroundSync] Flush timer started (every ${SYNC_CONFIG.FLUSH_INTERVAL}ms)`,
    );
  }

  /**
   * Load persisted queue items from database on startup
   */
  private async loadPersistedQueue() {
    try {
      const persistedItems = await db
        .select()
        .from(nmemSyncQueue)
        .where(lt(nmemSyncQueue.attempts, SYNC_CONFIG.MAX_RETRIES))
        .limit(100);

      for (const item of persistedItems) {
        this.queue.push({
          id: item.id,
          chatId: item.chatId,
          messageId: item.messageId,
          operation: item.operation as "save_message" | "save_summary",
          payload: JSON.parse(item.payload),
          attempts: item.attempts,
          createdAt: item.createdAt,
        });
      }

      logger.info(
        `[BackgroundSync] Loaded ${persistedItems.length} persisted queue items`,
      );
    } catch (error) {
      logger.error(
        "[BackgroundSync] Failed to load persisted queue:",
        error,
      );
    }
  }

  /**
   * Add a save_message operation to the queue
   */
  async queueSaveMessage(
    chatId: number,
    messageId: number,
    message: ModelMessage,
  ): Promise<void> {
    const item: QueueItem = {
      chatId,
      messageId,
      operation: "save_message",
      payload: { message },
      attempts: 0,
      createdAt: Date.now(),
    };

    this.queue.push(item);
    logger.info(
      `[BackgroundSync] Queued save_message (chatId: ${chatId}, messageId: ${messageId})`,
    );

    // Persist to database immediately
    await this.persistQueueItem(item);

    // Flush if batch size reached
    if (this.queue.length >= SYNC_CONFIG.BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Add a save_summary operation to the queue
   */
  async queueSaveSummary(
    chatId: number,
    messageId: number,
    summary: string,
    messageRange: { start: number; end: number },
  ): Promise<void> {
    const item: QueueItem = {
      chatId,
      messageId,
      operation: "save_summary",
      payload: { summary, messageRange },
      attempts: 0,
      createdAt: Date.now(),
    };

    this.queue.push(item);
    logger.info(
      `[BackgroundSync] Queued save_summary (chatId: ${chatId}, range: ${messageRange.start}-${messageRange.end})`,
    );

    await this.persistQueueItem(item);

    if (this.queue.length >= SYNC_CONFIG.BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * Persist a queue item to the database
   */
  private async persistQueueItem(item: QueueItem): Promise<void> {
    try {
      const result = await db
        .insert(nmemSyncQueue)
        .values({
          chatId: item.chatId,
          messageId: item.messageId,
          operation: item.operation,
          payload: JSON.stringify(item.payload),
          attempts: item.attempts,
          createdAt: item.createdAt,
        })
        .returning({ id: nmemSyncQueue.id });

      if (result.length > 0) {
        item.id = result[0].id;
      }
    } catch (error) {
      logger.error("[BackgroundSync] Failed to persist queue item:", error);
    }
  }

  /**
   * Process the queue (flush)
   */
  async flush(): Promise<void> {
    if (this.isProcessing) {
      logger.debug("[BackgroundSync] Already processing, skipping flush");
      return;
    }

    if (this.queue.length === 0) {
      logger.debug("[BackgroundSync] Queue is empty, nothing to flush");
      return;
    }

    this.isProcessing = true;
    const itemsToProcess = [...this.queue];
    this.queue = []; // Clear queue immediately

    logger.info(
      `[BackgroundSync] Flushing ${itemsToProcess.length} items from queue`,
    );

    for (const item of itemsToProcess) {
      await this.processItem(item);
    }

    this.isProcessing = false;
    logger.info("[BackgroundSync] Flush completed");
  }

  /**
   * Process a single queue item
   */
  private async processItem(item: QueueItem): Promise<void> {
    try {
      let success = false;

      if (item.operation === "save_message") {
        const payload = item.payload as SaveMessagePayload;
        success = await nmemService.saveMessage(
          item.chatId,
          payload.message,
          item.messageId,
        );
      } else if (item.operation === "save_summary") {
        const payload = item.payload as SaveSummaryPayload;
        success = await nmemService.saveSummary(
          item.chatId,
          payload.summary,
          payload.messageRange,
        );
      }

      if (success) {
        // Remove from persisted queue
        if (item.id) {
          await db.delete(nmemSyncQueue).where(eq(nmemSyncQueue.id, item.id));
        }
        logger.info(
          `[BackgroundSync] Successfully processed ${item.operation} (messageId: ${item.messageId})`,
        );
      } else {
        // Operation failed, retry if not exceeded max attempts
        await this.handleFailedItem(item);
      }
    } catch (error) {
      logger.error(
        `[BackgroundSync] Error processing item ${item.operation}:`,
        error,
      );
      await this.handleFailedItem(item);
    }
  }

  /**
   * Handle a failed queue item (retry or discard)
   */
  private async handleFailedItem(item: QueueItem): Promise<void> {
    item.attempts++;

    if (item.attempts < SYNC_CONFIG.MAX_RETRIES) {
      // Re-queue for retry
      logger.warn(
        `[BackgroundSync] Re-queueing failed item (attempt ${item.attempts}/${SYNC_CONFIG.MAX_RETRIES})`,
      );

      // Update persisted item
      if (item.id) {
        await db
          .update(nmemSyncQueue)
          .set({
            attempts: item.attempts,
            lastAttempt: Date.now(),
          })
          .where(eq(nmemSyncQueue.id, item.id));
      }

      // Add back to queue with delay
      setTimeout(() => {
        this.queue.push(item);
      }, SYNC_CONFIG.RETRY_BACKOFF);
    } else {
      // Max retries exceeded, discard
      logger.error(
        `[BackgroundSync] Discarding item after ${SYNC_CONFIG.MAX_RETRIES} failed attempts`,
        {
          chatId: item.chatId,
          messageId: item.messageId,
          operation: item.operation,
        },
      );

      if (item.id) {
        await db.delete(nmemSyncQueue).where(eq(nmemSyncQueue.id, item.id));
      }
    }
  }

  /**
   * Graceful shutdown - flush all pending items
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    logger.info("[BackgroundSync] Shutting down, flushing queue...");

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Wait for current processing to finish
    while (this.isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Flush remaining items
    await this.flush();

    logger.info("[BackgroundSync] Shutdown complete");
  }

  /**
   * Get queue status (for monitoring)
   */
  getStatus(): {
    queueLength: number;
    isProcessing: boolean;
    isShuttingDown: boolean;
  } {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      isShuttingDown: this.isShuttingDown,
    };
  }
}

// Singleton instance
let instance: BackgroundSyncService | null = null;

/**
 * Get the background sync service instance
 */
export function getBackgroundSyncService(): BackgroundSyncService {
  if (!instance) {
    instance = new BackgroundSyncService();
  }
  return instance;
}

/**
 * Queue a message to be saved to neural memory
 *
 * @example
 * ```ts
 * await queueMessageSync(42, 1337, userMessage);
 * ```
 */
export async function queueMessageSync(
  chatId: number,
  messageId: number,
  message: ModelMessage,
): Promise<void> {
  const service = getBackgroundSyncService();
  await service.queueSaveMessage(chatId, messageId, message);
}

/**
 * Queue a summary to be saved to neural memory
 *
 * @example
 * ```ts
 * await queueSummarySync(42, 50, 'User implemented auth', { start: 1, end: 50 });
 * ```
 */
export async function queueSummarySync(
  chatId: number,
  messageId: number,
  summary: string,
  messageRange: { start: number; end: number },
): Promise<void> {
  const service = getBackgroundSyncService();
  await service.queueSaveSummary(chatId, messageId, summary, messageRange);
}

/**
 * Manually flush the queue (for testing or forced sync)
 */
export async function flushQueue(): Promise<void> {
  const service = getBackgroundSyncService();
  await service.flush();
}

/**
 * Shutdown the background sync service gracefully
 * Should be called when app is closing
 */
export async function shutdownBackgroundSync(): Promise<void> {
  if (instance) {
    await instance.shutdown();
    instance = null;
  }
}

/**
 * Get queue status
 */
export function getQueueStatus() {
  const service = getBackgroundSyncService();
  return service.getStatus();
}
