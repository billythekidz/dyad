/**
 * Token Counter for Conversation Management
 *
 * Estimates token count in conversations to prevent hitting 200k limit.
 * Triggers auto-save to neural memory when approaching threshold.
 */

import type { ModelMessage } from 'ai';

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
