# Testing Best Practices & Patterns

This document outlines the standard patterns for testing in the Dyad codebase. Following these patterns ensures your tests are reliable, maintainable, and fast.

## 1. Mocking Strategies

### ❌ Don't: Partial Mocks without Default Exports
Vitest requires default exports to be mocked correctly when using `vi.mock`.

**Bad:**
```typescript
vi.mock('child_process', () => ({
  exec: vi.fn()
}));
```

**Good:**
```typescript
vi.mock('child_process', () => {
  return {
    exec: vi.fn(),
    default: { // Essential for some imports!
      exec: vi.fn(),
    }
  };
});
```

### ✅ Do: Isolate Mocks in `setup.ts`
Common mocks (like `electron` or `fs`) should be in `src/__tests__/setup.ts` if used globally. However, for specific logic, mock locally in the test file to avoid polluting other tests.

### ✅ Do: Use `vi.spyOn` for methods
If you want to mock a method on an object but keep the rest, use spyOn.
```typescript
import fs from 'fs';
const writeSpy = vi.spyOn(fs, 'writeFileSync');
```

---

## 2. Asynchronous Testing

### ❌ Don't: Use `done()` callback
Use `async/await` instead. It's cleaner and handles errors better.

**Bad:**
```typescript
it('fetches data', (done) => {
  fetchData().then(data => {
    expect(data).toBeDefined();
    done();
  });
});
```

**Good:**
```typescript
it('fetches data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});
```

### ✅ Do: Wait for Async State Updates
When testing React components or async logic, use `waitFor`.
```typescript
import { waitFor } from '@testing-library/react';

await waitFor(() => {
  expect(result.current.isLoaded).toBe(true);
});
```

---

## 3. Database Testing

### ❌ Don't: Connect to Production DB
Never let tests touch the real database.

### ✅ Do: Use In-Memory SQLite or Mocks
For integration tests, an in-memory SQLite DB is fast and isolated.
```typescript
// integration/setup.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

const sqlite = new Database(':memory:');
export const db = drizzle(sqlite);
```

For unit tests, mock the Drizzle query builder:
```typescript
vi.mock('../db', () => ({
  db: {
    query: {
      users: {
        findMany: vi.fn().mockResolvedValue([{ id: 1 }])
      }
    }
  }
}));
```

---

## 4. Snapshot Testing

### ⚠️ Caution with Snapshots
Snapshots are great for UI components but dangerous for logic.
*   **Good:** Verifying a complex object structure or rendered HTML.
*   **Bad:** Testing a function that returns a date (snapshots will break every run).

Always check the snapshot diff carefully!

---

## 5. Performance Benchmarking

When writing benchmarks (`*.bench.ts`):
1.  **Isolate the function**: Don't benchmark the DB connection, just the query logic or data processing.
2.  **Mock Heavy I/O**: Use mocks for file system or network to measure CPU time, not latency.
3.  **Warmup**: Vitest Bench handles warmup, but ensure your code doesn't have "first-run" side effects (like heavy lazy loading) unless that's what you're testing.

---

## 6. Testing Electron IPC

Electron's IPC is asynchronous and event-based.
*   **Mock `ipcMain.handle`**: Verify the handler is registered.
*   **Mock `ipcRenderer.invoke`**: Verify the frontend calls the backend correctly.

Example:
```typescript
// Testing a handler registration
import { ipcMain } from 'electron';
import { registerHandlers } from './handlers';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() }
}));

it('registers "get-app-version" handler', () => {
  registerHandlers();
  expect(ipcMain.handle).toHaveBeenCalledWith('get-app-version', expect.any(Function));
});
```
