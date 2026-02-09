/**
 * Comprehensive telemetry for Neural Memory-First Architecture
 * Part of Phase 5: Optimization & Rollout
 */

import log from "electron-log";

export interface ContextAssembledEvent {
  chatId: string;
  activeWindowSize: number;
  recalledMessagesCount: number;
  summariesIncluded: number;
  totalTokens: number;
  latencyMs: number;
  memoryMode: "neural" | "legacy";
  timestamp: number;
}

export interface ConversationSummarizedEvent {
  chatId: string;
  messageRange: [number, number];
  summaryTokens: number;
  latencyMs: number;
  timestamp: number;
}

export interface ChatMigratedEvent {
  chatId: string;
  totalMessages: number;
  migrationLatencyMs: number;
  timestamp: number;
}

export interface CacheHitEvent {
  cacheType: "activeWindow" | "recall";
  chatId: string;
  hit: boolean;
  latencyMs: number;
  timestamp: number;
}

export interface NmemBatchEvent {
  operationType: "add" | "update" | "delete";
  batchSize: number;
  latencyMs: number;
  cliCallsSaved: number;
  timestamp: number;
}

export interface PerformanceMetric {
  operation: string;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  timestamp: number;
}

export class NeuralMemoryTelemetry {
  private events: {
    contextAssembled: ContextAssembledEvent[];
    conversationSummarized: ConversationSummarizedEvent[];
    chatMigrated: ChatMigratedEvent[];
    cacheHits: CacheHitEvent[];
    nmemBatch: NmemBatchEvent[];
    performance: PerformanceMetric[];
  } = {
    contextAssembled: [],
    conversationSummarized: [],
    chatMigrated: [],
    cacheHits: [],
    nmemBatch: [],
    performance: [],
  };

  private readonly maxEventsPerType = 1000; // Keep last 1000 events

  /**
   * Track context assembly event
   */
  trackContextAssembled(event: Omit<ContextAssembledEvent, "timestamp">): void {
    const fullEvent: ContextAssembledEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.contextAssembled.push(fullEvent);
    this.trimEvents("contextAssembled");

    log.info("[Telemetry] Context assembled:", {
      chatId: event.chatId,
      mode: event.memoryMode,
      tokens: event.totalTokens,
      latency: `${event.latencyMs.toFixed(2)}ms`,
      activeWindow: event.activeWindowSize,
      recalled: event.recalledMessagesCount,
      summaries: event.summariesIncluded,
    });
  }

  /**
   * Track conversation summarization event
   */
  trackConversationSummarized(
    event: Omit<ConversationSummarizedEvent, "timestamp">,
  ): void {
    const fullEvent: ConversationSummarizedEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.conversationSummarized.push(fullEvent);
    this.trimEvents("conversationSummarized");

    log.info("[Telemetry] Conversation summarized:", {
      chatId: event.chatId,
      range: event.messageRange,
      tokens: event.summaryTokens,
      latency: `${event.latencyMs.toFixed(2)}ms`,
    });
  }

  /**
   * Track chat migration event
   */
  trackChatMigrated(event: Omit<ChatMigratedEvent, "timestamp">): void {
    const fullEvent: ChatMigratedEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.chatMigrated.push(fullEvent);
    this.trimEvents("chatMigrated");

    log.info("[Telemetry] Chat migrated:", {
      chatId: event.chatId,
      messages: event.totalMessages,
      latency: `${event.migrationLatencyMs.toFixed(2)}ms`,
    });
  }

  /**
   * Track cache hit/miss event
   */
  trackCacheEvent(event: Omit<CacheHitEvent, "timestamp">): void {
    const fullEvent: CacheHitEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.cacheHits.push(fullEvent);
    this.trimEvents("cacheHits");
  }

  /**
   * Track nmem batch operation
   */
  trackNmemBatch(event: Omit<NmemBatchEvent, "timestamp">): void {
    const fullEvent: NmemBatchEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.nmemBatch.push(fullEvent);
    this.trimEvents("nmemBatch");

    log.info("[Telemetry] Nmem batch operation:", {
      type: event.operationType,
      batchSize: event.batchSize,
      saved: event.cliCallsSaved,
      latency: `${event.latencyMs.toFixed(2)}ms`,
    });
  }

  /**
   * Track generic performance metric
   */
  trackPerformance(event: Omit<PerformanceMetric, "timestamp">): void {
    const fullEvent: PerformanceMetric = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.performance.push(fullEvent);
    this.trimEvents("performance");

    if (!event.success) {
      log.warn("[Telemetry] Performance issue:", {
        operation: event.operation,
        latency: `${event.latencyMs.toFixed(2)}ms`,
        error: event.errorMessage,
      });
    }
  }

  /**
   * Get analytics summary
   */
  getAnalytics(timeWindowMs: number = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const cutoff = now - timeWindowMs;

    // Filter events within time window
    const recentContext = this.events.contextAssembled.filter(
      (e) => e.timestamp >= cutoff,
    );
    const recentSummaries = this.events.conversationSummarized.filter(
      (e) => e.timestamp >= cutoff,
    );
    const recentMigrations = this.events.chatMigrated.filter(
      (e) => e.timestamp >= cutoff,
    );
    const recentCacheHits = this.events.cacheHits.filter(
      (e) => e.timestamp >= cutoff,
    );
    const recentBatches = this.events.nmemBatch.filter((e) => e.timestamp >= cutoff);
    const recentPerf = this.events.performance.filter((e) => e.timestamp >= cutoff);

    // Calculate token usage comparison
    const neuralTokens = recentContext
      .filter((e) => e.memoryMode === "neural")
      .reduce((sum, e) => sum + e.totalTokens, 0);
    const legacyTokens = recentContext
      .filter((e) => e.memoryMode === "legacy")
      .reduce((sum, e) => sum + e.totalTokens, 0);

    const tokenReduction =
      legacyTokens > 0 ? ((legacyTokens - neuralTokens) / legacyTokens) * 100 : 0;

    // Calculate cache hit rate
    const cacheHits = recentCacheHits.filter((e) => e.hit).length;
    const cacheMisses = recentCacheHits.filter((e) => !e.hit).length;
    const cacheHitRate =
      cacheHits + cacheMisses > 0 ? (cacheHits / (cacheHits + cacheMisses)) * 100 : 0;

    // Calculate performance percentiles
    const contextLatencies = recentContext.map((e) => e.latencyMs).sort((a, b) => a - b);
    const summaryLatencies = recentSummaries
      .map((e) => e.latencyMs)
      .sort((a, b) => a - b);

    const p95 = (arr: number[]) =>
      arr[Math.ceil(arr.length * 0.95) - 1] || 0;

    // Calculate error rate
    const errors = recentPerf.filter((e) => !e.success).length;
    const errorRate = recentPerf.length > 0 ? (errors / recentPerf.length) * 100 : 0;

    // Calculate nmem batch efficiency
    const totalCliCallsSaved = recentBatches.reduce(
      (sum, e) => sum + e.cliCallsSaved,
      0,
    );
    const totalBatchedOps = recentBatches.reduce((sum, e) => sum + e.batchSize, 0);
    const batchEfficiency =
      totalBatchedOps > 0 ? (totalCliCallsSaved / totalBatchedOps) * 100 : 0;

    return {
      timeWindow: timeWindowMs,
      tokenUsage: {
        neural: neuralTokens,
        legacy: legacyTokens,
        reduction: tokenReduction,
      },
      performance: {
        contextAssemblyP95: p95(contextLatencies),
        summarizationP95: p95(summaryLatencies),
        errorRate,
      },
      cache: {
        hits: cacheHits,
        misses: cacheMisses,
        hitRate: cacheHitRate,
      },
      batch: {
        totalOperations: totalBatchedOps,
        cliCallsSaved: totalCliCallsSaved,
        efficiency: batchEfficiency,
      },
      migration: {
        totalMigrations: recentMigrations.length,
        totalMessages: recentMigrations.reduce((sum, e) => sum + e.totalMessages, 0),
      },
      activity: {
        contextAssemblies: recentContext.length,
        summarizations: recentSummaries.length,
        neuralModeUsage:
          recentContext.length > 0
            ? (recentContext.filter((e) => e.memoryMode === "neural").length /
                recentContext.length) *
              100
            : 0,
      },
    };
  }

  /**
   * Trim events to max size
   */
  private trimEvents(type: keyof typeof this.events): void {
    const events = this.events[type];
    if (events.length > this.maxEventsPerType) {
      // Keep only the most recent events
      this.events[type] = events.slice(-this.maxEventsPerType) as any;
    }
  }

  /**
   * Export telemetry data
   */
  exportData() {
    return {
      ...this.events,
      analytics: this.getAnalytics(),
    };
  }

  /**
   * Clear all telemetry data
   */
  clear(): void {
    this.events = {
      contextAssembled: [],
      conversationSummarized: [],
      chatMigrated: [],
      cacheHits: [],
      nmemBatch: [],
      performance: [],
    };
  }
}

// Singleton instance
export const telemetry = new NeuralMemoryTelemetry();
