/**
 * Semantic Recall Service
 *
 * Retrieves relevant context from Neural Memory using semantic search.
 * Includes caching layer for performance optimization.
 *
 * @module semantic_recall
 */

import { recall as nmemRecall } from "./nmem_service";
import type { ModelMessage } from "ai";
import log from "electron-log";
import { getConfig } from "./context_detector";

const logger = log.scope("semantic_recall");

// LRU Cache for recalled context
interface CachedRecall {
  messages: ModelMessage[];
  timestamp: number;
  query: string;
}

class RecallCache {
  private cache = new Map<string, CachedRecall>();
  private maxSize = 200; // Phase 5: Increased from 100 to 200 entries

  /**
   * Get cached recall results
   */
  get(chatId: number, keywords: string[]): ModelMessage[] | null {
    const config = getConfig();
    if (!config.cacheEnabled) return null;

    const key = this.makeKey(chatId, keywords);
    const cached = this.cache.get(key);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < config.cacheTTL * 1000) {
        logger.info(`[RecallCache] Cache hit for chat ${chatId}`, {
          query: cached.query,
          age: `${Math.round(age / 1000)}s`,
        });
        return cached.messages;
      } else {
        // Expired, remove from cache
        this.cache.delete(key);
        logger.info(`[RecallCache] Cache expired for chat ${chatId}`);
      }
    }

    return null;
  }

  /**
   * Store recall results in cache
   */
  set(chatId: number, keywords: string[], messages: ModelMessage[]): void {
    const config = getConfig();
    if (!config.cacheEnabled) return;

    const key = this.makeKey(chatId, keywords);
    this.cache.set(key, {
      messages,
      timestamp: Date.now(),
      query: keywords.join(" "),
    });

    // LRU eviction
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      logger.info("[RecallCache] Evicted oldest entry (LRU)");
    }

    logger.info(`[RecallCache] Cached results for chat ${chatId}`, {
      keywords,
      count: messages.length,
    });
  }

  /**
   * Clear cache for a specific chat
   */
  clearChat(chatId: number): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${chatId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.cache.delete(key));
    logger.info(`[RecallCache] Cleared cache for chat ${chatId}`);
  }

  /**
   * Clear entire cache
   */
  clearAll(): void {
    this.cache.clear();
    logger.info("[RecallCache] Cleared all cache");
  }

  private makeKey(chatId: number, keywords: string[]): string {
    // Sort keywords for consistent cache keys
    const sortedKeywords = [...keywords].sort();
    return `${chatId}:${sortedKeywords.join(",")}`;
  }
}

// Singleton cache instance
const recallCache = new RecallCache();

/**
 * Parse nmem recall output into ModelMessage format
 *
 * nmem returns messages in format:
 * "chatId:42 messageId:1337 role:user timestamp:... content here"
 */
function parseNmemOutput(nmemResults: string[]): ModelMessage[] {
  const messages: ModelMessage[] = [];

  for (const result of nmemResults) {
    try {
      // Extract role from the memory string
      const roleMatch = result.match(/role:(user|assistant)/);
      if (!roleMatch) {
        logger.warn("[parseNmemOutput] No role found in:", result.substring(0, 100));
        continue;
      }

      const role = roleMatch[1] as "user" | "assistant";

      // Extract content (everything after the metadata)
      // Format: "chatId:X messageId:Y role:Z timestamp:T CONTENT"
      const contentMatch = result.match(/timestamp:\S+\s+(.+)$/s);
      if (!contentMatch) {
        logger.warn("[parseNmemOutput] No content found in:", result.substring(0, 100));
        continue;
      }

      const content = contentMatch[1].trim();

      if (content) {
        messages.push({ role, content });
      }
    } catch (error) {
      logger.error("[parseNmemOutput] Failed to parse nmem result:", error);
    }
  }

  return messages;
}

/**
 * Recall relevant context from neural memory
 *
 * @param chatId - Chat ID to search within
 * @param keywords - Keywords for semantic search
 * @param limit - Maximum number of messages to return (default: from config)
 * @returns Array of relevant ModelMessage objects
 *
 * @example
 * ```ts
 * const recalled = await recallContext(42, ['authentication', 'login'], 5);
 * console.log(`Recalled ${recalled.length} messages`);
 * ```
 */
export async function recallContext(
  chatId: number,
  keywords: string[],
  limit?: number,
): Promise<ModelMessage[]> {
  // Check cache first
  const cached = recallCache.get(chatId, keywords);
  if (cached) {
    return cached;
  }

  const config = getConfig();
  const maxMessages = limit || config.maxRecalledMessages;
  const depth = config.recallDepth;

  try {
    logger.info(`[recallContext] Recalling context for chat ${chatId}`, {
      keywords,
      depth,
      maxMessages,
    });

    // Build query string from keywords
    const query = keywords.join(" ");

    // Query nmem using the recall service
    const nmemResults = await nmemRecall(chatId, query, depth);

    if (nmemResults.length === 0) {
      logger.info(`[recallContext] No results found for query: ${query}`);
      return [];
    }

    // Parse nmem output into ModelMessage format
    const messages = parseNmemOutput(nmemResults);

    // Limit to maxMessages
    const limitedMessages = messages.slice(0, maxMessages);

    logger.info(
      `[recallContext] Successfully recalled ${limitedMessages.length} messages`,
      {
        totalResults: nmemResults.length,
        parsedMessages: messages.length,
        returned: limitedMessages.length,
      }
    );

    // Cache the results
    recallCache.set(chatId, keywords, limitedMessages);

    return limitedMessages;
  } catch (error) {
    logger.error("[recallContext] Failed to recall context:", error);
    return []; // Graceful degradation
  }
}

/**
 * Clear cache for a specific chat (useful after new messages added)
 */
export function clearCacheForChat(chatId: number): void {
  recallCache.clearChat(chatId);
}

/**
 * Clear all recall cache
 */
export function clearAllCache(): void {
  recallCache.clearAll();
}

/**
 * Get cache statistics (for debugging/monitoring)
 */
export function getCacheStats() {
  return {
    size: recallCache["cache"].size,
    maxSize: recallCache["maxSize"],
  };
}
