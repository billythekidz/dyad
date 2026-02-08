/**
 * Auto-Save Conversation to Neural Memory
 *
 * When conversation approaches token limit, automatically save all context
 * to neural memory with project scope, then create new conversation.
 */

import type { ModelMessage } from 'ai';
import { exec } from 'child_process';
import { promisify } from 'util';
import log from 'electron-log';

const execAsync = promisify(exec);
const logger = log.scope('auto_save');

export interface ConversationSummary {
  projectScope: string;
  messageCount: number;
  keyDecisions: string[];
  errors: string[];
  features: string[];
  totalTokens: number;
}

/**
 * Extract key information from conversation
 */
export function summarizeConversation(messages: ModelMessage[]): ConversationSummary {
  const summary: ConversationSummary = {
    projectScope: '',
    messageCount: messages.length,
    keyDecisions: [],
    errors: [],
    features: [],
    totalTokens: 0,
  };

  for (const message of messages) {
    const content = typeof message.content === 'string'
      ? message.content
      : Array.isArray(message.content)
        ? message.content.filter(p => p.type === 'text').map(p => (p as any).text).join(' ')
        : '';

    // Extract decisions
    if (content.match(/decided|decision|chose|selected|going with/i)) {
      summary.keyDecisions.push(content.slice(0, 200));
    }

    // Extract errors/fixes
    if (content.match(/error|bug|fix|solved|resolved/i)) {
      summary.errors.push(content.slice(0, 200));
    }

    // Extract features
    if (content.match(/implemented|created|added|built|feature/i)) {
      summary.features.push(content.slice(0, 200));
    }
  }

  return summary;
}

/**
 * Save conversation to neural memory
 */
export async function saveConversationToMemory(
  messages: ModelMessage[],
  projectScope: string,
  projectPath: string
): Promise<boolean> {
  try {
    logger.info(`[AutoSave] Saving conversation to neural memory (scope: ${projectScope})`);

    const summary = summarizeConversation(messages);

    // 1. Save project context
    const contextCommand = `remember "Project: ${projectScope} - Conversation archived with ${summary.messageCount} messages. Key work: ${summary.features.length} features, ${summary.errors.length} fixes, ${summary.keyDecisions.length} decisions." --type project --priority 9`;

    logger.info(`[AutoSave] Running: nmem ${contextCommand}`);

    try {
      const { stdout, stderr } = await execAsync(`nmem ${contextCommand}`, {
        timeout: 30000,
        maxBuffer: 5 * 1024 * 1024,
      });
      logger.info('[AutoSave] Project context saved');
      if (stderr) logger.warn('[AutoSave] stderr:', stderr);
    } catch (err: any) {
      logger.error('[AutoSave] Failed to save project context:', err);
      logger.error('[AutoSave] Error details:', {
        message: err.message,
        code: err.code,
        stderr: err.stderr,
        stdout: err.stdout,
      });
      throw err; // Re-throw to trigger catch block
    }

    // 2. Save key decisions
    for (const decision of summary.keyDecisions.slice(0, 10)) {
      // Limit to top 10
      try {
        const decisionCommand = `remember "${decision.replace(/"/g, '\\"')}" --type decision --priority 8`;
        await execAsync(`nmem ${decisionCommand}`, {
          timeout: 10000,
        });
      } catch (err) {
        logger.warn('[AutoSave] Failed to save decision:', err);
      }
    }

    logger.info(`[AutoSave] Saved ${Math.min(summary.keyDecisions.length, 10)} decisions`);

    // 3. Save errors/fixes
    for (const error of summary.errors.slice(0, 10)) {
      try {
        const errorCommand = `remember "${error.replace(/"/g, '\\"')}" --type error --priority 7`;
        await execAsync(`nmem ${errorCommand}`, {
          timeout: 10000,
        });
      } catch (err) {
        logger.warn('[AutoSave] Failed to save error:', err);
      }
    }

    logger.info(`[AutoSave] Saved ${Math.min(summary.errors.length, 10)} errors`);

    // 4. Index project directory (if available)
    if (projectPath) {
      try {
        const indexCommand = `index "${projectPath}"`;
        await execAsync(`nmem ${indexCommand}`, {
          timeout: 60000,
        });
        logger.info('[AutoSave] Project directory indexed');
      } catch (err) {
        logger.warn('[AutoSave] Failed to index project:', err);
      }
    }

    // 5. Consolidate memories
    try {
      await execAsync('nmem consolidate', { timeout: 30000 });
      logger.info('[AutoSave] Memories consolidated');
    } catch (err) {
      logger.warn('[AutoSave] Consolidation warning:', err);
    }

    logger.info('[AutoSave] ✅ Conversation successfully saved to neural memory');
    return true;
  } catch (error) {
    logger.error('[AutoSave] ❌ Failed to save conversation:', error);
    return false;
  }
}

/**
 * Load project context from neural memory
 */
export async function loadProjectContext(projectScope: string): Promise<string> {
  try {
    logger.info(`[AutoLoad] Loading context for project: ${projectScope}`);

    // 1. Get recent context
    const { stdout: context } = await execAsync('nmem context --limit 20', {
      timeout: 10000,
    });

    // 2. Get today's work
    const { stdout: today } = await execAsync('nmem today', {
      timeout: 10000,
    });

    // 3. Recall project-specific info
    const { stdout: projectInfo } = await execAsync(
      `nmem recall "${projectScope}" --depth 2`,
      {
        timeout: 10000,
      }
    );

    const contextMessage = `
🧠 **Neural Memory Context Loaded**

**Recent Context (Last 20 memories):**
${context}

**Today's Work:**
${today}

**Project-Specific Context:**
${projectInfo}

---
✅ Context restored from neural memory. Continue where we left off!
`.trim();

    logger.info('[AutoLoad] ✅ Context loaded successfully');
    return contextMessage;
  } catch (error) {
    logger.warn('[AutoLoad] ⚠️ Failed to load full context:', error);
    return '⚠️ Context partially loaded from neural memory.';
  }
}
