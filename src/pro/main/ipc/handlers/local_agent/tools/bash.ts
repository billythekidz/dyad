import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import type { ToolDefinition } from './types';

const execAsync = promisify(exec);

/**
 * Bash tool - Execute shell commands
 * This enables the agent to run terminal commands like Claude Code CLI
 */
export const bash: ToolDefinition = {
  name: 'bash',
  description: `Execute bash/shell commands in the project directory.

Usage:
- Run npm scripts: "npm run dev", "npm test"
- Git operations: "git status", "git add .", "git commit"
- File operations: "ls", "cat file.txt", "mkdir folder"
- Package management: "npm install package", "pnpm add package"
- Build commands: "npm run build", "tsc"
- Any shell command available in the system

Important:
- Commands run in the project root directory
- Output is captured (stdout + stderr)
- Use \`&&\` to chain commands: "npm install && npm run build"
- Be careful with destructive commands (rm, etc)
- Long-running commands (servers) should use \`&\` to run in background`,

  inputSchema: z.object({
    command: z.string().describe('The shell command to execute (e.g., "npm run dev", "git status")'),
    description: z.string().optional().describe('Brief description of what this command does (for logging)'),
  }),

  defaultConsent: 'ask' as const,
  modifiesState: true,

  getConsentPreview: (args) => {
    return `Run command: ${args.command}`;
  },

  execute: async (args, context) => {
    const { command, description } = args;
    const { appPath } = context;

    try {
      console.log(`[Bash Tool] Executing: ${command}`);
      console.log(`[Bash Tool] Description: ${description || 'N/A'}`);
      console.log(`[Bash Tool] Working directory: ${appPath}`);

      // Security checks - block dangerous commands
      const dangerousPatterns = [
        /rm\s+-rf\s+\//,  // rm -rf /
        /:\(\)\{.*\|.*&\s*\};:/,  // fork bombs
        />\s*\/dev\/sda/,  // disk overwrite
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(command)) {
          throw new Error(`Blocked dangerous command: ${command}`);
        }
      }

      // Execute command with 60-second timeout
      const { stdout, stderr } = await execAsync(command, {
        cwd: appPath,
        timeout: 60000, // 60 seconds
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        env: {
          ...process.env,
          // Ensure npm/pnpm/yarn are available
          PATH: process.env.PATH,
        },
      });

      const output = [stdout, stderr].filter(Boolean).join('\n\n');

      console.log(`[Bash Tool] Success!`);
      console.log(`[Bash Tool] Output:\n${output.slice(0, 500)}...`);

      return output || 'Command executed successfully (no output)';
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      const stderr = error.stderr || '';
      const stdout = error.stdout || '';

      console.error(`[Bash Tool] Error executing command:`, errorMessage);

      // Combine stdout/stderr for better error context
      const fullOutput = [stdout, stderr, errorMessage].filter(Boolean).join('\n\n');

      throw new Error(`Command failed: ${fullOutput}`);
    }
  },
};
