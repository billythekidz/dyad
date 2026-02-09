# Testing Dyad: A Contributor's Guide

This guide covers everything you need to know about testing in the Dyad repository. Whether you're adding a small bug fix or a major feature, tests are required to ensure stability.

## 🚀 Quick Start

### Run All Tests
```bash
npm test
```
This runs all unit and integration tests using Vitest.

### Run Specific Tests
```bash
# Run a specific file
npx vitest src/lib/nmem_service.test.ts

# Run tests matching a pattern
npx vitest -t "saveMessage"
```

### Watch Mode
```bash
npm run test:watch
```
Great for TDD! Runs tests automatically when you save a file.

### UI Mode
```bash
npm run test:ui
```
Opens a web interface to browse and run tests visually.

---

## 🏗️ Test Structure

We follow the **Testing Pyramid**:

1.  **Unit Tests** (`*.test.ts`): Fast, isolated tests for individual functions.
    *   Located alongside source files or in `src/__tests__`.
    *   Use **Vitest**.
    *   Mock external dependencies (DB, Electron, FS).

2.  **Integration Tests** (`*.integration.test.ts`): Test how modules work together.
    *   Located in `src/__tests__/integration`.
    *   Use **Vitest** with a test database (in-memory SQLite).

3.  **End-to-End (E2E) Tests** (`*.spec.ts`): Test the full application flow.
    *   Located in `e2e-tests/`.
    *   Use **Playwright**.
    *   Run against a built version of the app.

4.  **Performance Tests** (`*.bench.ts`): Micro-benchmarks for critical paths.
    *   Located in `src/__tests__/performance`.
    *   Use **Vitest Bench**.

---

## ✍️ How to Write a Test

### 1. Identify What to Test
*   **Pure Functions**: Input -> Output.
*   **Side Effects**: Database writes, File I/O, IPC calls (use mocks!).
*   **Components**: Render -> Interact -> Assert state.

### 2. Create the File
If you are testing `src/lib/my_feature.ts`, create `src/lib/my_feature.test.ts`.

### 3. Basic Template
```typescript
import { describe, it, expect, vi } from 'vitest';
import { myFeature } from './my_feature';

describe('myFeature', () => {
  it('should return true when input is valid', () => {
    const result = myFeature('valid input');
    expect(result).toBe(true);
  });

  it('should throw error on invalid input', () => {
    expect(() => myFeature(null)).toThrow();
  });
});
```

---

## 🧩 Mocking Dependencies

Dyad relies heavily on Electron, SQLite, and the file system. You MUST mock these in unit tests.

### Mocking `electron-log`
```typescript
vi.mock('electron-log', () => ({
  default: {
    scope: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));
```

### Mocking Database (Drizzle)
```typescript
vi.mock('../db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnValue([]), // Return empty array by default
  },
}));
```

See [Best Practices](./BEST_PRACTICES.md) for more complex mocking patterns.

---

## 🏃 Running E2E Tests

E2E tests require building the app first.

```bash
# 1. Build the app for testing
npm run pre:e2e

# 2. Run Playwright tests
npm run e2e
```

**Note:** E2E tests can be flaky. If a test fails, try running it in debug mode:
```bash
npx playwright test --debug
```

---

## 📊 Performance Testing

For critical paths (like Neural Memory or large file parsing), use benchmarks.

```bash
# Run benchmarks
npx vitest bench
```

See `src/__tests__/performance/README.md` for details.
