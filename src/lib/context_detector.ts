/**
 * Context Need Detection
 *
 * Detects when the user is referencing past work and needs context retrieval.
 * Uses pattern matching and keyword extraction to identify context needs.
 *
 * @module context_detector
 */

import log from "electron-log";
import fs from "node:fs";
import path from "node:path";

const logger = log.scope("context_detector");

// Load configuration
let config: ContextRetrievalConfig | null = null;

export interface ContextRetrievalConfig {
  triggers: Array<{
    pattern: string;
    confidence: number;
  }>;
  maxRecalledMessages: number;
  recallDepth: number;
  cacheEnabled: boolean;
  cacheTTL: number;
}

// Default configuration
const DEFAULT_CONFIG: ContextRetrievalConfig = {
  triggers: [
    { pattern: "remember when", confidence: 0.9 },
    { pattern: "like we did", confidence: 0.85 },
    { pattern: "like you did", confidence: 0.85 },
    { pattern: "like you said", confidence: 0.85 },
    { pattern: "as we discussed", confidence: 0.85 },
    { pattern: "earlier you", confidence: 0.8 },
    { pattern: "earlier we", confidence: 0.8 },
    { pattern: "yesterday", confidence: 0.7 },
    { pattern: "last week", confidence: 0.7 },
    { pattern: "last month", confidence: 0.7 },
    { pattern: "before", confidence: 0.6 },
    { pattern: "previously", confidence: 0.75 },
    { pattern: "continue", confidence: 0.7 },
    { pattern: "resume", confidence: 0.7 },
    { pattern: "the bug", confidence: 0.65 },
    { pattern: "the feature", confidence: 0.65 },
    { pattern: "the issue", confidence: 0.65 },
    { pattern: "that we", confidence: 0.6 },
    { pattern: "what did we", confidence: 0.9 },
    { pattern: "what did you", confidence: 0.9 },
    { pattern: "can you recall", confidence: 0.95 },
    { pattern: "do you remember", confidence: 0.95 },
  ],
  maxRecalledMessages: 5,
  recallDepth: 3,
  cacheEnabled: true,
  cacheTTL: 300, // 5 minutes
};

/**
 * Load configuration from file or use defaults
 */
function loadConfig(): ContextRetrievalConfig {
  if (config) return config;

  try {
    const configPath = path.join(__dirname, "../../config/context_retrieval.json");
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, "utf-8");
      config = JSON.parse(fileContent);
      logger.info("[loadConfig] Loaded configuration from file");
      return config!;
    }
  } catch (error) {
    logger.warn("[loadConfig] Failed to load config file, using defaults:", error);
  }

  config = DEFAULT_CONFIG;
  return config;
}

/**
 * Extract keywords from user message for semantic search
 *
 * Removes common stop words and extracts meaningful terms.
 */
function extractKeywords(message: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "were", "are", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "should", "could", "may", "might", "can", "we", "you", "i",
    "me", "my", "your", "our", "this", "that", "these", "those", "it",
    "its", "they", "them", "their", "what", "which", "who", "when",
    "where", "why", "how", "remember", "like", "earlier", "before",
  ]);

  // Convert to lowercase and split into words
  const words = message
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2) // Keep words longer than 2 chars
    .filter(word => !stopWords.has(word)); // Remove stop words

  // Return unique keywords
  return Array.from(new Set(words));
}

/**
 * Detect if user message needs context retrieval
 *
 * @param userMessage - User's message to analyze
 * @returns Detection result with keywords and confidence
 *
 * @example
 * ```ts
 * const result = detectContextNeed("Remember when we worked on auth?");
 * if (result.needsContext) {
 *   console.log("Keywords:", result.keywords);
 *   console.log("Confidence:", result.confidence);
 * }
 * ```
 */
export interface ContextNeedResult {
  needsContext: boolean;
  keywords: string[];
  confidence: number;
  triggeredPatterns: string[];
}

export function detectContextNeed(userMessage: string): ContextNeedResult {
  const cfg = loadConfig();
  const lowerMessage = userMessage.toLowerCase();

  let maxConfidence = 0;
  const triggeredPatterns: string[] = [];

  // Check all trigger patterns
  for (const trigger of cfg.triggers) {
    if (lowerMessage.includes(trigger.pattern)) {
      triggeredPatterns.push(trigger.pattern);
      maxConfidence = Math.max(maxConfidence, trigger.confidence);
    }
  }

  // Extract keywords for semantic search
  const keywords = extractKeywords(userMessage);

  // Determine if context is needed
  // Need context if:
  // 1. At least one trigger pattern matched, OR
  // 2. Message is asking a question about past work (heuristic)
  const needsContext =
    triggeredPatterns.length > 0 ||
    (keywords.length > 3 && lowerMessage.includes("?"));

  const result: ContextNeedResult = {
    needsContext,
    keywords: keywords.slice(0, 10), // Limit to top 10 keywords
    confidence: maxConfidence,
    triggeredPatterns,
  };

  if (needsContext) {
    logger.info("[detectContextNeed] Context needed", {
      confidence: result.confidence,
      keywords: result.keywords,
      patterns: result.triggeredPatterns,
    });
  }

  return result;
}

/**
 * Get configuration for external use
 */
export function getConfig(): ContextRetrievalConfig {
  return loadConfig();
}

/**
 * Update configuration (for testing/tuning)
 */
export function updateConfig(newConfig: Partial<ContextRetrievalConfig>): void {
  const current = loadConfig();
  config = { ...current, ...newConfig };
  logger.info("[updateConfig] Configuration updated");
}
