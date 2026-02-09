/**
 * In-memory LRU cache for context retrieval performance optimization
 * Part of Phase 5: Optimization & Rollout
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry is expired
    const age = Date.now() - entry.timestamp;
    if (age > this.ttlMs) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }

    // Update LRU - move to end
    this.cache.delete(key);
    entry.hits++;
    entry.timestamp = Date.now();
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.value;
  }

  set(key: string, value: T): void {
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
    }

    // Remove existing entry if present (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      size: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }
}

// Active window cache - 5 minute TTL
const ACTIVE_WINDOW_TTL = 5 * 60 * 1000; // 5 minutes
const ACTIVE_WINDOW_MAX_SIZE = 100; // Cache up to 100 chat windows

// Recall results cache - 5 minute TTL
const RECALL_RESULTS_TTL = 5 * 60 * 1000; // 5 minutes
const RECALL_RESULTS_MAX_SIZE = 200; // Cache up to 200 recall results

export const activeWindowCache = new LRUCache<any>(
  ACTIVE_WINDOW_MAX_SIZE,
  ACTIVE_WINDOW_TTL,
);

export const recallResultsCache = new LRUCache<any>(
  RECALL_RESULTS_MAX_SIZE,
  RECALL_RESULTS_TTL,
);

/**
 * Generate cache key for active window
 */
export function getActiveWindowCacheKey(chatId: string): string {
  return `active_window:${chatId}`;
}

/**
 * Generate cache key for recall results
 */
export function getRecallCacheKey(
  chatId: string,
  query: string,
  limit: number,
): string {
  // Hash the query for consistent key
  const queryHash = Buffer.from(query).toString("base64").slice(0, 32);
  return `recall:${chatId}:${queryHash}:${limit}`;
}

/**
 * Get combined cache statistics
 */
export function getCombinedCacheStats() {
  return {
    activeWindow: activeWindowCache.getStats(),
    recallResults: recallResultsCache.getStats(),
  };
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  activeWindowCache.clear();
  recallResultsCache.clear();
}

/**
 * Reset all cache statistics
 */
export function resetAllCacheStats(): void {
  activeWindowCache.resetStats();
  recallResultsCache.resetStats();
}
