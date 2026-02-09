/**
 * Summarization Service for Neural Memory-First Architecture
 *
 * Automatically summarizes message ranges to support unlimited conversation length.
 *
 * Features:
 * - Summarizes every 50 messages
 * - Uses Claude API for high-quality summaries
 * - Stores summaries in DB and nmem
 * - Keeps summaries concise (<500 tokens)
 * - Non-blocking background processing
 *
 * @module summarization_service
 */

import log from "electron-log";
import type { ModelMessage } from "ai";
import { db } from "../db";
import { messages, conversationSummaries, chatMemoryConfig } from "../db/schema";
import { eq, and, between, gte, lte } from "drizzle-orm";
import { getModelClient } from "../ipc/utils/get_model_client";
import { readSettings } from "../main/settings";
import * as nmemService from "../lib/nmem_service";
import { queueSummarySync } from "./background_sync";
import { estimateTokens } from "../lib/token_counter";
import { performArchival } from "./message_archival_service";

const logger = log.scope("summarization_service");

// Configuration
const SUMMARIZATION_CONFIG = {
  MESSAGE_INTERVAL: 50, // Summarize every 50 messages
  MAX_SUMMARY_TOKENS: 500, // Keep summaries concise
  SUMMARY_TIMEOUT: 30000, // 30 seconds timeout for Claude API
} as const;

/**
 * Prompt for summarizing message ranges
 */
const SUMMARIZATION_PROMPT = `You are a conversation summarizer. Analyze the following messages and create a concise summary.

Focus on:
- Key decisions made
- Features implemented or planned
- Bugs fixed
- Important context and requirements
- Technical approaches chosen

Keep the summary concise (under 500 tokens). Use bullet points for clarity.

Format:
## Summary
[Your concise summary here]`;

/**
 * Check if summarization is needed for a chat
 *
 * @param chatId - Chat ID
 * @returns true if summarization should be triggered
 */
export async function shouldSummarize(chatId: number): Promise<boolean> {
  try {
    const config = await db
      .select()
      .from(chatMemoryConfig)
      .where(eq(chatMemoryConfig.chatId, chatId))
      .limit(1);

    if (!config || config.length === 0) {
      logger.info(`[shouldSummarize] No config found for chat ${chatId}`);
      return false;
    }

    const { totalMessages, lastSummarizedMessageId } = config[0];
    const lastSummarized = lastSummarizedMessageId || 0;
    const messagesSinceLastSummary = totalMessages - lastSummarized;

    const shouldTrigger =
      messagesSinceLastSummary >= SUMMARIZATION_CONFIG.MESSAGE_INTERVAL;

    if (shouldTrigger) {
      logger.info(
        `[shouldSummarize] Summarization needed for chat ${chatId}` +
          ` (${messagesSinceLastSummary} messages since last summary)`
      );
    }

    return shouldTrigger;
  } catch (error) {
    logger.error("[shouldSummarize] Error checking if summarization needed:", error);
    return false;
  }
}

/**
 * Get message range for summarization
 *
 * @param chatId - Chat ID
 * @returns Message range { startId, endId } or null
 */
export async function getMessageRangeForSummarization(
  chatId: number
): Promise<{ startId: number; endId: number; messages: any[] } | null> {
  try {
    const config = await db
      .select()
      .from(chatMemoryConfig)
      .where(eq(chatMemoryConfig.chatId, chatId))
      .limit(1);

    if (!config || config.length === 0) {
      return null;
    }

    const lastSummarized = config[0].lastSummarizedMessageId || 0;

    // Get messages after last summarized
    const messagesToSummarize = await db
      .select({
        id: messages.id,
        role: messages.role,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(and(eq(messages.chatId, chatId), gte(messages.id, lastSummarized + 1)))
      .orderBy(messages.createdAt)
      .limit(SUMMARIZATION_CONFIG.MESSAGE_INTERVAL);

    if (messagesToSummarize.length === 0) {
      return null;
    }

    const startId = messagesToSummarize[0].id;
    const endId = messagesToSummarize[messagesToSummarize.length - 1].id;

    logger.info(
      `[getMessageRangeForSummarization] Found ${messagesToSummarize.length} messages to summarize (${startId}-${endId})`
    );

    return {
      startId,
      endId,
      messages: messagesToSummarize,
    };
  } catch (error) {
    logger.error("[getMessageRangeForSummarization] Error getting message range:", error);
    return null;
  }
}

/**
 * Summarize a range of messages using Claude API
 *
 * @param chatId - Chat ID
 * @param startMessageId - Start message ID
 * @param endMessageId - End message ID
 * @returns Summary object with text and token estimate
 *
 * @example
 * ```ts
 * const summary = await summarizeMessageRange(42, 1, 50);
 * console.log('Summary:', summary.summary);
 * ```
 */
export async function summarizeMessageRange(
  chatId: number,
  startMessageId: number,
  endMessageId: number
): Promise<{ summary: string; estimatedTokens: number } | null> {
  try {
    logger.info(
      `[summarizeMessageRange] Summarizing messages ${startMessageId}-${endMessageId} for chat ${chatId}`
    );

    // Fetch messages in range
    const messagesToSummarize = await db
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
          gte(messages.id, startMessageId),
          lte(messages.id, endMessageId)
        )
      )
      .orderBy(messages.createdAt);

    if (messagesToSummarize.length === 0) {
      logger.warn(
        `[summarizeMessageRange] No messages found in range ${startMessageId}-${endMessageId}`
      );
      return null;
    }

    // Format messages for Claude
    const formattedMessages = messagesToSummarize
      .map(
        (msg, idx) =>
          `[Message ${idx + 1}] ${msg.role.toUpperCase()}: ${msg.content}`
      )
      .join("\n\n");

    // Get model settings
    const settings = readSettings();
    const modelClient = getModelClient(settings);

    // Call Claude API to generate summary
    const systemPrompt = SUMMARIZATION_PROMPT;
    const userPrompt = `Here are ${messagesToSummarize.length} messages to summarize:\n\n${formattedMessages}`;

    logger.info(
      `[summarizeMessageRange] Calling Claude API for summarization...`
    );

    // Use streamText with accumulation (or could use generateText for simplicity)
    const { textStream } = await modelClient.client.streamText({
      model: modelClient.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: SUMMARIZATION_CONFIG.MAX_SUMMARY_TOKENS,
      temperature: 0.3, // Lower temperature for more focused summaries
      abortSignal: AbortSignal.timeout(SUMMARIZATION_CONFIG.SUMMARY_TIMEOUT),
    });

    // Accumulate the summary text
    let summaryText = "";
    for await (const chunk of textStream) {
      summaryText += chunk;
    }

    // Trim and validate
    summaryText = summaryText.trim();
    if (!summaryText) {
      logger.error("[summarizeMessageRange] Generated summary is empty");
      return null;
    }

    // Estimate tokens
    const tokens = estimateTokens(summaryText);

    logger.info(
      `[summarizeMessageRange] Summary generated successfully (${tokens} tokens)`
    );

    return {
      summary: summaryText,
      estimatedTokens: tokens,
    };
  } catch (error) {
    logger.error("[summarizeMessageRange] Error generating summary:", error);
    return null;
  }
}

/**
 * Save summary to database and nmem
 *
 * @param chatId - Chat ID
 * @param startMessageId - Start message ID
 * @param endMessageId - End message ID
 * @param summary - Summary text
 * @param estimatedTokens - Token estimate
 * @returns Summary ID or null
 */
export async function saveSummary(
  chatId: number,
  startMessageId: number,
  endMessageId: number,
  summary: string,
  estimatedTokens: number
): Promise<number | null> {
  try {
    logger.info(
      `[saveSummary] Saving summary for chat ${chatId}, messages ${startMessageId}-${endMessageId}`
    );

    // 1. Insert into conversationSummaries table
    const result = await db
      .insert(conversationSummaries)
      .values({
        chatId,
        startMessageId,
        endMessageId,
        summary,
        estimatedTokens,
        nmemSynced: false,
      })
      .returning({ id: conversationSummaries.id });

    if (!result || result.length === 0) {
      logger.error("[saveSummary] Failed to insert summary into database");
      return null;
    }

    const summaryId = result[0].id;

    // 2. Update messages.summaryId for all messages in range
    await db
      .update(messages)
      .set({ summaryId })
      .where(
        and(
          eq(messages.chatId, chatId),
          gte(messages.id, startMessageId),
          lte(messages.id, endMessageId)
        )
      );

    // 3. Update chatMemoryConfig.lastSummarizedMessageId
    await db
      .update(chatMemoryConfig)
      .set({ lastSummarizedMessageId: endMessageId })
      .where(eq(chatMemoryConfig.chatId, chatId));

    // 4. Queue summary for nmem sync (non-blocking)
    await queueSummarySync(chatId, summaryId, summary, {
      start: startMessageId,
      end: endMessageId,
    });

    logger.info(
      `[saveSummary] Summary saved successfully (ID: ${summaryId})`
    );

    return summaryId;
  } catch (error) {
    logger.error("[saveSummary] Error saving summary:", error);
    return null;
  }
}

/**
 * Trigger summarization for a chat (background job)
 *
 * This is the main entry point called every 50 messages.
 * Also triggers archival for long conversations (500+ messages).
 *
 * @param chatId - Chat ID
 * @returns Summary ID if successful, null otherwise
 *
 * @example
 * ```ts
 * // After saving assistant message
 * if (totalMessages % 50 === 0) {
 *   triggerSummarization(chatId);
 * }
 * ```
 */
export async function triggerSummarization(
  chatId: number
): Promise<number | null> {
  try {
    logger.info(`[triggerSummarization] Starting summarization for chat ${chatId}`);

    // Check if summarization is needed
    const needed = await shouldSummarize(chatId);
    if (!needed) {
      logger.info(
        `[triggerSummarization] Summarization not needed for chat ${chatId}`
      );
      return null;
    }

    // Get message range
    const range = await getMessageRangeForSummarization(chatId);
    if (!range) {
      logger.warn(
        `[triggerSummarization] No message range found for chat ${chatId}`
      );
      return null;
    }

    const { startId, endId } = range;

    // Generate summary
    const result = await summarizeMessageRange(chatId, startId, endId);
    if (!result) {
      logger.error(
        `[triggerSummarization] Failed to generate summary for chat ${chatId}`
      );
      return null;
    }

    const { summary, estimatedTokens } = result;

    // Save summary
    const summaryId = await saveSummary(
      chatId,
      startId,
      endId,
      summary,
      estimatedTokens
    );

    if (summaryId) {
      logger.info(
        `[triggerSummarization] Summarization completed successfully for chat ${chatId} (summary ID: ${summaryId})`
      );

      // Trigger archival for long conversations (non-blocking)
      performArchival(chatId).catch((error) => {
        logger.error("[triggerSummarization] Archival failed (non-blocking):", error);
      });
    } else {
      logger.error(
        `[triggerSummarization] Failed to save summary for chat ${chatId}`
      );
    }

    return summaryId;
  } catch (error) {
    logger.error("[triggerSummarization] Error during summarization:", error);
    return null;
  }
}

/**
 * Get all summaries for a chat
 *
 * @param chatId - Chat ID
 * @param limit - Maximum number of summaries to return (default: 10)
 * @returns Array of summaries
 */
export async function getChatSummaries(
  chatId: number,
  limit: number = 10
): Promise<
  Array<{
    id: number;
    startMessageId: number;
    endMessageId: number;
    summary: string;
    estimatedTokens: number;
    createdAt: Date;
  }>
> {
  try {
    const summaries = await db
      .select()
      .from(conversationSummaries)
      .where(eq(conversationSummaries.chatId, chatId))
      .orderBy(conversationSummaries.createdAt)
      .limit(limit);

    return summaries.map((s) => ({
      id: s.id,
      startMessageId: s.startMessageId,
      endMessageId: s.endMessageId,
      summary: s.summary,
      estimatedTokens: s.estimatedTokens,
      createdAt: s.createdAt,
    }));
  } catch (error) {
    logger.error("[getChatSummaries] Error fetching summaries:", error);
    return [];
  }
}
