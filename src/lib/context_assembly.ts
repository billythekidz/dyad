/**
 * Context Assembly
 *
 * Assembles the conversation context for Claude using the Neural Memory-First Architecture.
 *
 * Features:
 * - Returns only 'active' tier messages for token efficiency
 * - Optimized queries with proper indexes
 * - Formats messages in ModelMessage[] format compatible with AI SDK
 * - LRU caching for performance (Phase 5 optimization)
 *
 * @module context_assembly
 */

import { db } from "../db";
import { messages, chatMemoryConfig, conversationSummaries } from "../db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import type { ModelMessage } from "ai";
import log from "electron-log";
import { activeWindowCache, getActiveWindowCacheKey } from "./context_cache";

const logger = log.scope("context_assembly");

/**
 * Get active window messages for a chat
 *
 * Returns only messages with memory_tier = 'active', ordered chronologically.
 * For long conversations (>100 messages), includes summaries of earlier messages.
 * These are the messages that will be sent to Claude.
 *
 * @param chatId - Chat ID
 * @param includeSummaries - Whether to include summaries (default: true)
 * @returns Array of ModelMessage objects in chronological order
 *
 * @example
 * ```ts
 * const activeMessages = await getActiveWindow(42);
 * console.log(`Sending ${activeMessages.length} messages to Claude`);
 * ```
 */
export async function getActiveWindow(
  chatId: number,
  includeSummaries: boolean = true
): Promise<ModelMessage[]> {
  try {
    // Phase 5: Check cache first for performance
    const cacheKey = getActiveWindowCacheKey(String(chatId));
    const cached = activeWindowCache.get(cacheKey);
    if (cached) {
      logger.info(`[getActiveWindow] Cache hit for chat ${chatId}`);
      return cached as ModelMessage[];
    }

    logger.info(`[getActiveWindow] Cache miss - retrieving active window for chat ${chatId}`);

    // Check total message count to determine if summaries should be included
    const config = await getChatMemoryConfig(chatId);
    const totalMessages = config?.totalMessages || 0;

    // Fetch only active tier messages
    const activeMessages = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
        aiMessagesJson: messages.aiMessagesJson,
      })
      .from(messages)
      .where(
        and(
          eq(messages.chatId, chatId),
          eq(messages.memoryTier, "active")
        )
      )
      .orderBy(asc(messages.createdAt));

    logger.info(
      `[getActiveWindow] Retrieved ${activeMessages.length} active messages for chat ${chatId} (total messages: ${totalMessages})`
    );

    // Convert to ModelMessage format
    const modelMessages: ModelMessage[] = activeMessages.map((msg) => {
      // If aiMessagesJson exists and contains messages, use those
      // (preserves tool calls, etc. for agent mode)
      if (msg.aiMessagesJson?.messages && msg.aiMessagesJson.messages.length > 0) {
        // Return the messages from aiMessagesJson
        return msg.aiMessagesJson.messages;
      }

      // Otherwise, return simple text message
      return {
        role: msg.role as "user" | "assistant",
        content: msg.content,
      };
    }).flat(); // Flatten in case aiMessagesJson had multiple messages

    // Include summaries for long conversations (>100 messages)
    if (includeSummaries && totalMessages > 100) {
      logger.info(`[getActiveWindow] Including summaries for long conversation (${totalMessages} messages)`);

      // Fetch the last 3 summaries
      const summaries = await db
        .select({
          id: conversationSummaries.id,
          startMessageId: conversationSummaries.startMessageId,
          endMessageId: conversationSummaries.endMessageId,
          summary: conversationSummaries.summary,
          createdAt: conversationSummaries.createdAt,
        })
        .from(conversationSummaries)
        .where(eq(conversationSummaries.chatId, chatId))
        .orderBy(desc(conversationSummaries.createdAt))
        .limit(3);

      if (summaries.length > 0) {
        // Reverse to chronological order (oldest first)
        summaries.reverse();

        // Create summary messages
        const summaryMessages: ModelMessage[] = summaries.map((s) => ({
          role: "system",
          content: `CONVERSATION SUMMARY (messages ${s.startMessageId}-${s.endMessageId}):\n\n${s.summary}`,
        }));

        // Inject summaries before active window
        const contextWithSummaries: ModelMessage[] = [
          ...summaryMessages,
          {
            role: "system",
            content: "--- RECENT CONVERSATION (active window) ---",
          },
          ...modelMessages,
        ];

        logger.info(
          `[getActiveWindow] Added ${summaries.length} summaries to context` +
          ` (total context: ${contextWithSummaries.length} messages)`
        );

        return contextWithSummaries;
      }
    }

    // Phase 5: Cache the result before returning
    activeWindowCache.set(cacheKey, modelMessages);

    return modelMessages;
  } catch (error) {
    logger.error(
      `[getActiveWindow] Failed to retrieve active window for chat ${chatId}:`,
      error
    );
    // Return empty array on failure - graceful degradation
    return [];
  }
}

/**
 * Get session tier messages for semantic retrieval
 *
 * Returns messages with memory_tier = 'session'.
 * These can be queried semantically but are not in the active window.
 *
 * @param chatId - Chat ID
 * @returns Array of session messages
 *
 * @example
 * ```ts
 * const sessionMessages = await getSessionMessages(42);
 * // Use for semantic search
 * ```
 */
export async function getSessionMessages(chatId: number): Promise<{
  id: number;
  role: string;
  content: string;
  createdAt: Date;
}[]> {
  try {
    const sessionMessages = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(
        and(
          eq(messages.chatId, chatId),
          eq(messages.memoryTier, "session")
        )
      )
      .orderBy(asc(messages.createdAt));

    logger.info(
      `[getSessionMessages] Retrieved ${sessionMessages.length} session messages for chat ${chatId}`
    );

    return sessionMessages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    }));
  } catch (error) {
    logger.error(
      `[getSessionMessages] Failed to retrieve session messages:`,
      error
    );
    return [];
  }
}

/**
 * Get memory configuration for a chat
 *
 * @param chatId - Chat ID
 * @returns Memory configuration or null if not found
 *
 * @example
 * ```ts
 * const config = await getChatMemoryConfig(42);
 * console.log(`Active window size: ${config?.activeWindowSize}`);
 * ```
 */
export async function getChatMemoryConfig(chatId: number) {
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
 * Estimate token count for active window
 *
 * Uses cached token estimates from messages table for fast calculation.
 *
 * @param chatId - Chat ID
 * @returns Estimated token count
 *
 * @example
 * ```ts
 * const tokens = await estimateActiveWindowTokens(42);
 * console.log(`Active window: ~${tokens} tokens`);
 * ```
 */
export async function estimateActiveWindowTokens(chatId: number): Promise<number> {
  try {
    const activeMessages = await db
      .select({
        content: messages.content,
        estimatedTokens: messages.estimatedTokens,
      })
      .from(messages)
      .where(
        and(
          eq(messages.chatId, chatId),
          eq(messages.memoryTier, "active")
        )
      );

    let totalTokens = 0;

    for (const msg of activeMessages) {
      if (msg.estimatedTokens) {
        // Use cached estimate
        totalTokens += msg.estimatedTokens;
      } else {
        // Fallback: rough estimate (4 chars per token)
        totalTokens += Math.ceil(msg.content.length / 4);
      }
    }

    return totalTokens;
  } catch (error) {
    logger.error(
      `[estimateActiveWindowTokens] Failed to estimate tokens:`,
      error
    );
    return 0;
  }
}

/**
 * Get all messages for legacy mode (backward compatibility)
 *
 * Returns ALL messages regardless of tier, for systems that don't use neural memory.
 *
 * @param chatId - Chat ID
 * @returns All messages in chronological order
 *
 * @example
 * ```ts
 * const allMessages = await getAllMessages(42);
 * ```
 */
export async function getAllMessages(chatId: number): Promise<ModelMessage[]> {
  try {
    logger.info(`[getAllMessages] Retrieving all messages for chat ${chatId} (legacy mode)`);

    const allMessages = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
        aiMessagesJson: messages.aiMessagesJson,
      })
      .from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(asc(messages.createdAt));

    logger.info(
      `[getAllMessages] Retrieved ${allMessages.length} messages for chat ${chatId}`
    );

    // Convert to ModelMessage format
    const modelMessages: ModelMessage[] = allMessages.map((msg) => {
      // If aiMessagesJson exists and contains messages, use those
      if (msg.aiMessagesJson?.messages && msg.aiMessagesJson.messages.length > 0) {
        return msg.aiMessagesJson.messages;
      }

      // Otherwise, return simple text message
      return {
        role: msg.role as "user" | "assistant",
        content: msg.content,
      };
    }).flat();

    return modelMessages;
  } catch (error) {
    logger.error(
      `[getAllMessages] Failed to retrieve messages for chat ${chatId}:`,
      error
    );
    return [];
  }
}

/**
 * Merge recalled context with active window
 *
 * Combines semantically recalled messages with the active window,
 * ensuring no duplicates and proper ordering.
 *
 * @param activeWindow - Current active window messages
 * @param recalled - Recalled messages from semantic search
 * @param tokenBudget - Maximum tokens allowed (default: 40000)
 * @returns Merged context with marker separating recalled and active
 *
 * @example
 * ```ts
 * const active = await getActiveWindow(42);
 * const recalled = await recallContext(42, ['auth'], 5);
 * const merged = mergeContexts(active, recalled);
 * ```
 */
export function mergeContexts(
  activeWindow: ModelMessage[],
  recalled: ModelMessage[],
  tokenBudget: number = 40000,
): ModelMessage[] {
  // If no recalled messages, return active window as-is
  if (recalled.length === 0) {
    return activeWindow;
  }

  logger.info(`[mergeContexts] Merging contexts`, {
    activeCount: activeWindow.length,
    recalledCount: recalled.length,
  });

  // Deduplicate by content (simple approach)
  // More sophisticated: track message IDs if available
  const activeContents = new Set(
    activeWindow.map((msg) =>
      typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
    )
  );

  const uniqueRecalled = recalled.filter((msg) => {
    const content =
      typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    return !activeContents.has(content);
  });

  logger.info(`[mergeContexts] After deduplication: ${uniqueRecalled.length} unique recalled messages`);

  // If no unique recalled messages after dedup, return active window
  if (uniqueRecalled.length === 0) {
    logger.info("[mergeContexts] No unique recalled messages, using active window only");
    return activeWindow;
  }

  // Create marker messages to separate recalled from active context
  const recalledMarker: ModelMessage = {
    role: "system",
    content: `RECALLED CONTEXT (from earlier in conversation):
The following ${uniqueRecalled.length} message(s) are relevant context from earlier in this conversation.`,
  };

  const activeMarker: ModelMessage = {
    role: "system",
    content: "RECENT CONTEXT:",
  };

  // Assemble final context
  const mergedContext: ModelMessage[] = [
    recalledMarker,
    ...uniqueRecalled,
    activeMarker,
    ...activeWindow,
  ];

  // Check token budget (rough estimate: 4 chars per token)
  const estimatedTokens = mergedContext.reduce((sum, msg) => {
    const content =
      typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    return sum + Math.ceil(content.length / 4);
  }, 0);

  if (estimatedTokens > tokenBudget) {
    logger.warn(
      `[mergeContexts] Merged context exceeds token budget (${estimatedTokens} > ${tokenBudget})`
    );

    // Trim recalled messages if over budget
    // Keep active window intact, trim recalled
    let trimmedRecalled = uniqueRecalled;
    while (trimmedRecalled.length > 0 && estimatedTokens > tokenBudget) {
      trimmedRecalled = trimmedRecalled.slice(1); // Remove oldest recalled

      const newEstimate = [
        recalledMarker,
        ...trimmedRecalled,
        activeMarker,
        ...activeWindow,
      ].reduce((sum, msg) => {
        const content =
          typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        return sum + Math.ceil(content.length / 4);
      }, 0);

      if (newEstimate <= tokenBudget) {
        logger.info(
          `[mergeContexts] Trimmed to ${trimmedRecalled.length} recalled messages to fit budget`
        );
        return [recalledMarker, ...trimmedRecalled, activeMarker, ...activeWindow];
      }
    }

    // If still over budget after trimming all recalled, just use active window
    logger.warn("[mergeContexts] Could not fit recalled messages in budget, using active window only");
    return activeWindow;
  }

  logger.info(`[mergeContexts] Merged context size: ${mergedContext.length} messages (~${estimatedTokens} tokens)`);

  return mergedContext;
}
