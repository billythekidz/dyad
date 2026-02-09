
import { bench, describe, vi } from 'vitest';
import * as nmemService from '../../lib/nmem_service';
import * as contextAssembly from '../../lib/context_assembly';
import { getBackgroundSyncService } from '../../services/background_sync';
import type { ModelMessage } from 'ai';

// Mock child_process for nmem CLI calls
vi.mock('child_process', () => {
  return {
    exec: (cmd: string, opts: any, cb: any) => {
      if (cb) cb(null, { stdout: 'Saved', stderr: '' });
      return { stdout: 'Saved', stderr: '' };
    },
    spawn: () => ({
      on: (event: string, cb: any) => {
        if (event === 'close') cb(0);
      },
      stdout: { on: () => {} },
      stderr: { on: () => {} },
      stdin: { write: () => {}, end: () => {} },
    }),
    default: {
      exec: (cmd: string, opts: any, cb: any) => {
        if (cb) cb(null, { stdout: 'Saved', stderr: '' });
        return { stdout: 'Saved', stderr: '' };
      },
      spawn: () => ({
        on: (event: string, cb: any) => {
          if (event === 'close') cb(0);
        },
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        stdin: { write: () => {}, end: () => {} },
      }),
    },
  };
});

// Mock node:child_process as well since some files import from there
vi.mock('node:child_process', () => {
  return {
    exec: (cmd: string, opts: any, cb: any) => {
      if (cb) cb(null, { stdout: 'Saved', stderr: '' });
      return { stdout: 'Saved', stderr: '' };
    },
    spawn: () => ({
      on: (event: string, cb: any) => {
        if (event === 'close') cb(0);
      },
      stdout: { on: () => {} },
      stderr: { on: () => {} },
      stdin: { write: () => {}, end: () => {} },
    }),
    default: {
      exec: (cmd: string, opts: any, cb: any) => {
        if (cb) cb(null, { stdout: 'Saved', stderr: '' });
        return { stdout: 'Saved', stderr: '' };
      },
      spawn: () => ({
        on: (event: string, cb: any) => {
          if (event === 'close') cb(0);
        },
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        stdin: { write: () => {}, end: () => {} },
      }),
    },
  };
});

vi.mock('electron-log', () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return {
    default: {
      scope: () => logger,
      ...logger,
    },
  };
});

// Mock DB
vi.mock('../../db', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnValue(
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message content ${i}`,
        createdAt: new Date(),
        memoryTier: 'active',
        aiMessagesJson: null,
      }))
    ),
    limit: vi.fn().mockReturnValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnValue([{ id: 1 }]),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };

  return {
    db: mockDb,
  };
});

vi.mock('../../db/schema', () => ({
  messages: { id: 'id', chatId: 'chatId', memoryTier: 'memoryTier', createdAt: 'createdAt' },
  chatMemoryConfig: { chatId: 'chatId' },
  conversationSummaries: { chatId: 'chatId', createdAt: 'createdAt' },
  nmemSyncQueue: { id: 'id', attempts: 'attempts' },
}));

describe('Neural Memory Performance', () => {
  const chatId = 1;
  const message: ModelMessage = { role: 'user', content: 'Test message' };

  bench('nmemService.saveMessage', async () => {
    await nmemService.saveMessage(chatId, message, 123);
  });

  bench('contextAssembly.getActiveWindow (50 msgs)', async () => {
    await contextAssembly.getActiveWindow(chatId);
  });

  bench('backgroundSync.queueSaveMessage', async () => {
    const service = getBackgroundSyncService();
    await service.queueSaveMessage(chatId, 123, message);
  });
});
