
import { describe, it, expect, vi } from 'vitest';
import { getBackgroundSyncService } from '../../services/background_sync';
import type { ModelMessage } from 'ai';

// Mock child_process and electron-log
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
    }
  };
});

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
    }
  };
});

vi.mock('electron-log', () => {
  const logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };
  return {
    default: {
      scope: () => logger,
      ...logger,
    },
  };
});

// Mock DB - Simplified for load testing (no real inserts)
vi.mock('../../db', () => {
  const mockDb = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [{ id: Math.floor(Math.random() * 100000) }])
      }))
    })),
    delete: vi.fn(() => ({
        where: vi.fn()
    })),
    update: vi.fn(() => ({
        set: vi.fn(() => ({
            where: vi.fn()
        }))
    })),
    select: vi.fn(() => ({
        from: vi.fn(() => ({
            where: vi.fn(() => ({
                limit: vi.fn(() => [])
            }))
        }))
    }))
  };
  return { db: mockDb };
});

vi.mock('../../db/schema', () => ({
  nmemSyncQueue: { id: 'id', attempts: 'attempts' },
}));


describe('Load Simulation: Background Sync', () => {
  it('should handle 10,000 messages without crashing', async () => {
    const service = getBackgroundSyncService();
    const messageCount = 10000;
    const chatId = 1;
    const message: ModelMessage = { role: 'user', content: 'Load test message' };

    console.log(`Starting load test with ${messageCount} messages...`);
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    // Flood the queue
    for (let i = 0; i < messageCount; i++) {
      await service.queueSaveMessage(chatId, i, message);
    }

    const queueTime = performance.now();
    console.log(`Queued ${messageCount} messages in ${(queueTime - startTime).toFixed(2)}ms`);

    // Wait for queue to drain (mock flush happens immediately due to batch size)
    // In real app, flush happens every 5s or 10 items.
    // Our mock executes flush synchronously when batch size is reached.

    // Manually force a final flush just in case
    await service.flush();

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    const duration = endTime - startTime;
    const memoryDiff = (endMemory - startMemory) / 1024 / 1024; // MB

    console.log(`Total time: ${duration.toFixed(2)}ms`);
    console.log(`Throughput: ${(messageCount / (duration / 1000)).toFixed(2)} msgs/sec`);
    console.log(`Memory usage delta: ${memoryDiff.toFixed(2)} MB`);

    expect(duration).toBeLessThan(5000); // Should be very fast with mocks
    expect(memoryDiff).toBeLessThan(200); // Should not leak massive memory (10k messages in memory)
  });
});
