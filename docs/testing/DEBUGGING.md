# Troubleshooting Failing Tests

This guide helps you debug common test failures in Dyad.

---

## 🛑 Common Errors

### 1. `Cannot mock 'child_process'`
**Symptom:** Vitest fails with `ReferenceError` or `cannot access before initialization`.
**Fix:**
*   Ensure `vi.mock` returns the mock object (or uses default exports correctly).
*   Check that you are mocking `default` if the module uses default exports.
*   See [Best Practices](./BEST_PRACTICES.md) for mock patterns.

### 2. `Electron API not found`
**Symptom:** `Error: electron is not defined` or similar.
**Fix:**
*   Electron modules are only available in the main/renderer processes, not in Node.js unit tests.
*   You **MUST** mock `electron` in your test file or setup.
```typescript
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  ipcRenderer: { invoke: vi.fn() },
  app: { getPath: () => '/tmp' },
}));
```

### 3. Database Connection Errors
**Symptom:** `Error: database is locked` or timeouts.
**Fix:**
*   Ensure you are using an in-memory SQLite DB for tests (`:memory:`).
*   Check if multiple tests are running in parallel against the same file-based DB (use `test.concurrent` carefully).
*   Mock the `db` import entirely for unit tests.

### 4. Component Rendering Issues
**Symptom:** `Error: invariant failed` or context errors.
**Fix:**
*   Wrap components in necessary providers (`<ThemeProvider>`, `<MemoryRouter>`).
*   Mock hooks like `useParams` or `useNavigate`.

---

## 🔍 Debugging Strategies

### Use `console.log` (Seriously!)
Vitest captures console output. Adding logs inside your test or the code under test is often the fastest way to trace execution flow.

### Use the UI Mode
Run `npm run test:ui`. This interactive mode lets you:
1.  See exactly which test failed.
2.  View the console logs for *that specific test*.
3.  Re-run only the failed test instantly.

### Check Async Timing
If a test is flaky:
*   Use `await waitFor(() => ...)` instead of `setTimeout`.
*   Ensure promises are awaited.
*   Check for unhandled promise rejections.

### Run in Isolation
Sometimes tests pollute the global state. Run a single test file to see if it passes alone:
```bash
npx vitest specific.test.ts
```

If it passes alone but fails in the suite, check for shared state or lack of cleanup (`afterEach`).
