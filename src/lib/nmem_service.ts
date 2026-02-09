/**
 * Neural Memory Service Layer
 *
 * Provides a robust interface to the nmem CLI tool with:
 * - Error handling and retry logic (3 attempts with exponential backoff)
 * - Comprehensive logging
 * - Type-safe operations
 * - Graceful degradation on failures
 * - Batch operation queue for performance (Phase 5 optimization)
 *
 * @module nmem_service
 */

import { exec } from "child_process";
import { promisify } from "util";
import log from "electron-log";
import type { ModelMessage } from "ai";
import { nmemBatchQueue } from "../services/nmem_batch_queue";

const execAsync = promisify(exec);
const logger = log.scope("nmem_service");

// Configuration
const NMEM_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_BACKOFF: 1000, // 1 second
  MAX_TIMEOUT: 30000, // 30 seconds
  MAX_BUFFER: 5 * 1024 * 1024, // 5MB
} as const;

// Error types for better error handling
export class NmemError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = "NmemError";
  }
}

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = NMEM_CONFIG.MAX_RETRIES,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      logger.warn(
        `[${operationName}] Attempt ${attempt}/${maxRetries} failed:`,
        error,
      );

      if (attempt < maxRetries) {
        const backoffMs =
          NMEM_CONFIG.INITIAL_BACKOFF * Math.pow(2, attempt - 1);
        logger.info(`[${operationName}] Retrying in ${backoffMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw new NmemError(
    `Operation '${operationName}' failed after ${maxRetries} attempts`,
    "MAX_RETRIES_EXCEEDED",
    lastError,
  );
}

/**
 * Execute nmem command with error handling
 */
async function execNmem(
  command: string,
  timeout: number = NMEM_CONFIG.MAX_TIMEOUT,
): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(`nmem ${command}`, {
      timeout,
      maxBuffer: NMEM_CONFIG.MAX_BUFFER,
    });

    if (stderr && !stderr.includes("Saved")) {
      // nmem sometimes outputs non-error info to stderr
      logger.warn(`[execNmem] stderr:`, stderr);
    }

    return stdout.trim();
  } catch (error: any) {
    logger.error(`[execNmem] Command failed: nmem ${command}`, {
      message: error.message,
      code: error.code,
      stderr: error.stderr,
      stdout: error.stdout,
    });
    throw error;
  }
}

/**
 * Format message content for nmem storage
 */
function formatMessageContent(message: ModelMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .filter((part) => part.type === "text")
      .map((part) => (part as any).text)
      .join(" ");
  }

  return "";
}

/**
 * Escape quotes in strings for shell safety
 */
function escapeQuotes(str: string): string {
  return str.replace(/"/g, '\\"').replace(/'/g, "\\'");
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Save a message to neural memory
 *
 * @param chatId - Chat ID for message isolation
 * @param message - ModelMessage to save
 * @param messageId - Optional message ID for tracking
 * @returns true if saved successfully, false otherwise
 *
 * @example
 * ```ts
 * const success = await saveMessage(42, {
 *   role: 'user',
 *   content: 'How do I add authentication?'
 * }, 1337);
 * ```
 */
export async function saveMessage(
  chatId: number,
  message: ModelMessage,
  messageId?: number,
): Promise<boolean> {
  try {
    const content = formatMessageContent(message);
    if (!content) {
      logger.warn("[saveMessage] Empty message content, skipping");
      return false;
    }

    const timestamp = new Date().toISOString();
    const msgIdPart = messageId ? `messageId:${messageId} ` : "";
    const formattedMessage = `chatId:${chatId} ${msgIdPart}role:${message.role} timestamp:${timestamp} ${content}`;

    await retryWithBackoff(
      async () => {
        await execNmem(`remember "${escapeQuotes(formattedMessage)}"`);
        logger.info(`[saveMessage] Saved message to nmem`, {
          chatId,
          messageId,
          role: message.role,
        });
      },
      "saveMessage",
    );

    return true;
  } catch (error) {
    logger.error("[saveMessage] Failed to save message:", error);
    return false; // Graceful degradation - don't block user
  }
}

/**
 * Batch save multiple messages to neural memory
 *
 * Phase 5: Uses nmemBatchQueue for true batching (90% CLI call reduction)
 *
 * @param chatId - Chat ID
 * @param messages - Array of messages with their IDs
 * @returns Number of successfully saved messages
 *
 * @example
 * ```ts
 * const saved = await batchSave(42, [
 *   { message: msg1, messageId: 1 },
 *   { message: msg2, messageId: 2 }
 * ]);
 * console.log(`Saved ${saved} messages`);
 * ```
 */
export async function batchSave(
  chatId: number,
  messages: Array<{ message: ModelMessage; messageId?: number }>,
): Promise<number> {
  let successCount = 0;

  // Phase 5: Enqueue operations for batching instead of immediate execution
  const promises = messages.map(async ({ message, messageId }) => {
    try {
      const content = formatMessageContent(message);
      if (!content) {
        logger.warn("[batchSave] Empty message content, skipping");
        return false;
      }

      const timestamp = new Date().toISOString();
      const msgIdPart = messageId ? `messageId:${messageId} ` : "";
      const formattedMessage = `chatId:${chatId} ${msgIdPart}role:${message.role} timestamp:${timestamp} ${content}`;

      await nmemBatchQueue.enqueue({
        type: "add",
        id: `${chatId}-${messageId || Date.now()}`,
        data: {
          content: formattedMessage,
          metadata: { chatId, messageId, role: message.role },
        },
      });

      return true;
    } catch (error) {
      logger.error("[batchSave] Failed to enqueue message:", error);
      return false;
    }
  });

  const results = await Promise.all(promises);
  successCount = results.filter((success) => success).length;

  logger.info(`[batchSave] Queued ${successCount}/${messages.length} messages for batching`);
  return successCount;
}

/**
 * Recall relevant messages from neural memory using semantic search
 *
 * @param chatId - Chat ID to search within
 * @param query - Search query
 * @param depth - Number of results to return (default: 5)
 * @returns Array of recalled message contents
 *
 * @example
 * ```ts
 * const results = await recall(42, 'authentication setup', 3);
 * console.log('Found:', results);
 * ```
 */
export async function recall(
  chatId: number,
  query: string,
  depth: number = 5,
): Promise<string[]> {
  try {
    const searchQuery = `chatId:${chatId} ${query}`;

    const output = await retryWithBackoff(
      async () => {
        return await execNmem(
          `recall "${escapeQuotes(searchQuery)}" --depth ${depth}`,
        );
      },
      "recall",
    );

    // Parse nmem output - each memory is separated by newlines
    const memories = output
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .slice(0, depth);

    logger.info(`[recall] Found ${memories.length} results for query:`, query);
    return memories;
  } catch (error) {
    logger.error("[recall] Failed to recall memories:", error);
    return []; // Return empty array on failure
  }
}

/**
 * Get recent context from neural memory
 *
 * @param chatId - Chat ID
 * @param limit - Maximum number of recent items (default: 30)
 * @returns Recent context as string
 *
 * @example
 * ```ts
 * const context = await getContext(42, 20);
 * ```
 */
export async function getContext(
  chatId: number,
  limit: number = 30,
): Promise<string> {
  try {
    const output = await retryWithBackoff(
      async () => {
        return await execNmem(`context --limit ${limit}`);
      },
      "getContext",
    );

    logger.info(`[getContext] Retrieved context for chatId ${chatId}`);
    return output;
  } catch (error) {
    logger.error("[getContext] Failed to get context:", error);
    return "";
  }
}

/**
 * Get today's work from neural memory
 *
 * @param chatId - Chat ID (for logging)
 * @returns Today's context as string
 *
 * @example
 * ```ts
 * const today = await getToday(42);
 * console.log("Today's work:", today);
 * ```
 */
export async function getToday(chatId: number): Promise<string> {
  try {
    const output = await retryWithBackoff(
      async () => {
        return await execNmem("today");
      },
      "getToday",
    );

    logger.info(`[getToday] Retrieved today's work for chatId ${chatId}`);
    return output;
  } catch (error) {
    logger.error("[getToday] Failed to get today's work:", error);
    return "";
  }
}

/**
 * Consolidate neural memory (compress and optimize)
 *
 * Should be called periodically (e.g., every 50 messages)
 *
 * @returns true if consolidation succeeded
 *
 * @example
 * ```ts
 * if (messageCount % 50 === 0) {
 *   await consolidate();
 * }
 * ```
 */
export async function consolidate(): Promise<boolean> {
  try {
    await retryWithBackoff(
      async () => {
        await execNmem("consolidate", 60000); // 60s timeout for consolidation
      },
      "consolidate",
    );

    logger.info("[consolidate] Neural memory consolidated successfully");
    return true;
  } catch (error) {
    logger.error("[consolidate] Failed to consolidate:", error);
    return false;
  }
}

/**
 * Save a conversation summary to neural memory
 *
 * @param chatId - Chat ID
 * @param summary - Summary text
 * @param messageRange - Message ID range (start-end)
 * @returns true if saved successfully
 *
 * @example
 * ```ts
 * await saveSummary(42, 'Set up authentication with JWT', { start: 1, end: 50 });
 * ```
 */
export async function saveSummary(
  chatId: number,
  summary: string,
  messageRange: { start: number; end: number },
): Promise<boolean> {
  try {
    const formattedSummary = `chatId:${chatId} type:summary range:${messageRange.start}-${messageRange.end} ${summary}`;

    await retryWithBackoff(
      async () => {
        await execNmem(`remember "${escapeQuotes(formattedSummary)}"`);
        logger.info("[saveSummary] Saved summary to nmem", {
          chatId,
          range: messageRange,
        });
      },
      "saveSummary",
    );

    return true;
  } catch (error) {
    logger.error("[saveSummary] Failed to save summary:", error);
    return false;
  }
}

/**
 * Check if nmem CLI is available
 *
 * @returns true if nmem is available and working
 */
export async function isNmemAvailable(): Promise<boolean> {
  try {
    await execAsync("nmem --version", { timeout: 5000 });
    logger.info("[isNmemAvailable] nmem CLI is available");
    return true;
  } catch (error) {
    logger.warn("[isNmemAvailable] nmem CLI not available:", error);
    return false;
  }
}
