/**
 * Token Counter for Conversation Management
 *
 * Estimates token count in conversations to prevent hitting 200k limit.
 * Triggers auto-save to neural memory when approaching threshold.
 *
 * NEW: Token estimation caching for performance optimization
 */

import type { ModelMessage } from 'ai';
import { db } from '../db';
import { messages } from '../db/schema';
import { eq } from 'drizzle-orm';
import log from 'electron-log';

const logger = log.scope('token_counter');

// Conservative token estimation (1 token ≈ 4 characters for English, 2-3 for Vietnamese)
const CHARS_PER_TOKEN = 3; // Average for mixed EN/VN

// Token limits and thresholds
export const TOKEN_LIMITS = {
  MAX_TOKENS: 200000,           // Claude API hard limit
  WARNING_THRESHOLD: 180000,    // 90% - trigger auto-save
  CRITICAL_THRESHOLD: 190000,   // 95% - force auto-save
  SYSTEM_PROMPT_COMPACT: 600,   // COMPACT mode baseline
  SYSTEM_PROMPT_FULL: 5000,     // FULL mode baseline
};

/**
 * Estimate token count from text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens in a single message
 */
export function estimateMessageTokens(message: ModelMessage): number {
  let total = 0;

  if (typeof message.content === 'string') {
    total += estimateTokens(message.content);
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === 'text') {
        total += estimateTokens(part.text);
      } else if (part.type === 'image') {
        // Images cost ~85 tokens for thumbnails, ~170 for detailed
        total += 170;
      }
    }
  }

  // Add overhead for role, metadata
  total += 10;

  return total;
}

/**
 * Estimate total tokens in conversation
 */
export function estimateConversationTokens(
  messages: ModelMessage[],
  systemPromptSize: number = TOKEN_LIMITS.SYSTEM_PROMPT_COMPACT
): number {
  let total = systemPromptSize;

  for (const message of messages) {
    total += estimateMessageTokens(message);
  }

  return total;
}

/**
 * Check if conversation should be auto-saved
 */
export function shouldAutoSaveConversation(
  messages: ModelMessage[],
  systemPromptSize: number = TOKEN_LIMITS.SYSTEM_PROMPT_COMPACT
): {
  shouldSave: boolean;
  isCritical: boolean;
  currentTokens: number;
  percentage: number;
} {
  const currentTokens = estimateConversationTokens(messages, systemPromptSize);
  const percentage = (currentTokens / TOKEN_LIMITS.MAX_TOKENS) * 100;

  return {
    shouldSave: currentTokens >= TOKEN_LIMITS.WARNING_THRESHOLD,
    isCritical: currentTokens >= TOKEN_LIMITS.CRITICAL_THRESHOLD,
    currentTokens,
    percentage,
  };
}

/**
 * Extract project scope identifier from path or git
 */
export async function extractProjectScope(projectPath: string): Promise<string> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Try to get git remote URL
    try {
      const { stdout } = await execAsync('git remote get-url origin', {
        cwd: projectPath,
        timeout: 5000,
      });

      // Extract repo name from URL (e.g., "github.com/user/repo" -> "user/repo")
      const match = stdout.trim().match(/[:/]([^/]+\/[^/]+?)(\.git)?$/);
      if (match) {
        return `git:${match[1]}`;
      }
    } catch (gitError) {
      // Not a git repo or no remote
    }

    // Fallback to directory name
    const path = await import('path');
    const dirName = path.basename(projectPath);
    return `path:${dirName}`;
  } catch (error) {
    return 'path:unknown';
  }
}

// ============================================================
// TOKEN ESTIMATION CACHING (NEW)
// ============================================================

/**
 * Cache token estimates for a specific message in the database
 *
 * @param messageId - Database message ID
 * @param estimatedTokens - Token count to cache
 *
 * @example
 * ```ts
 * await cacheMessageTokens(1337, 450);
 * ```
 */
export async function cacheMessageTokens(
  messageId: number,
  estimatedTokens: number,
): Promise<void> {
  try {
    await db
      .update(messages)
      .set({ estimatedTokens })
      .where(eq(messages.id, messageId));

    logger.debug(`[cacheMessageTokens] Cached ${estimatedTokens} tokens for message ${messageId}`);
  } catch (error) {
    logger.error('[cacheMessageTokens] Failed to cache tokens:', error);
  }
}

/**
 * Get cached token estimate for a message
 *
 * @param messageId - Database message ID
 * @returns Cached token count or null if not cached
 */
export async function getCachedMessageTokens(
  messageId: number,
): Promise<number | null> {
  try {
    const result = await db
      .select({ estimatedTokens: messages.estimatedTokens })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (result.length > 0 && result[0].estimatedTokens !== null) {
      return result[0].estimatedTokens;
    }

    return null;
  } catch (error) {
    logger.error('[getCachedMessageTokens] Failed to retrieve cached tokens:', error);
    return null;
  }
}

/**
 * Cache token estimates for all messages in a chat
 *
 * Useful for bulk operations or migration
 *
 * @param chatId - Chat ID
 * @returns Number of messages cached
 *
 * @example
 * ```ts
 * const cached = await cacheTokenEstimates(42);
 * console.log(`Cached tokens for ${cached} messages`);
 * ```
 */
export async function cacheTokenEstimates(chatId: number): Promise<number> {
  try {
    logger.info(`[cacheTokenEstimates] Caching token estimates for chat ${chatId}`);

    // Get all messages for this chat that don't have cached estimates
    const uncachedMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId));

    let cachedCount = 0;

    for (const message of uncachedMessages) {
      // Skip if already cached
      if (message.estimatedTokens !== null) {
        continue;
      }

      // Estimate tokens
      const modelMessage: ModelMessage = {
        role: message.role,
        content: message.content,
      };

      const tokens = estimateMessageTokens(modelMessage);

      // Cache in database
      await db
        .update(messages)
        .set({ estimatedTokens: tokens })
        .where(eq(messages.id, message.id));

      cachedCount++;
    }

    logger.info(`[cacheTokenEstimates] Cached ${cachedCount} message token estimates for chat ${chatId}`);
    return cachedCount;
  } catch (error) {
    logger.error('[cacheTokenEstimates] Failed to cache token estimates:', error);
    return 0;
  }
}

/**
 * Estimate conversation tokens using cached values when available
 *
 * Falls back to live estimation if cache miss
 *
 * @param chatId - Chat ID
 * @param systemPromptSize - System prompt token count
 * @returns Total estimated tokens
 */
export async function estimateConversationTokensCached(
  chatId: number,
  systemPromptSize: number = TOKEN_LIMITS.SYSTEM_PROMPT_COMPACT,
): Promise<number> {
  try {
    const chatMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.chatId, chatId));

    let total = systemPromptSize;

    for (const message of chatMessages) {
      if (message.estimatedTokens !== null) {
        // Use cached value
        total += message.estimatedTokens;
      } else {
        // Cache miss - estimate and cache
        const modelMessage: ModelMessage = {
          role: message.role,
          content: message.content,
        };

        const tokens = estimateMessageTokens(modelMessage);
        total += tokens;

        // Cache for future use (async, don't wait)
        cacheMessageTokens(message.id, tokens).catch(() => {});
      }
    }

    logger.debug(`[estimateConversationTokensCached] Chat ${chatId}: ${total} tokens (${chatMessages.length} messages)`);
    return total;
  } catch (error) {
    logger.error('[estimateConversationTokensCached] Failed:', error);
    // Fallback to non-cached estimation
    return systemPromptSize;
  }
}
