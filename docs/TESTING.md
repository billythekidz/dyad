# Dyad Testing Documentation

Welcome to the central hub for testing documentation in Dyad.

## 📚 Guides

### [Testing Strategy](../../TESTING_STRATEGY.md)
The high-level overview of our testing philosophy, pyramid, and CI/CD integration. Start here to understand the "Big Picture".

### [Contributor Guide](./testing/CONTRIBUTING.md)
**Read this first if you are a developer!**
Covers:
*   How to run tests locally (`npm test`, watch mode, UI mode).
*   Where to add new tests.
*   Basic templates for unit and integration tests.

### [Best Practices](./testing/BEST_PRACTICES.md)
Detailed patterns and anti-patterns for writing robust tests.
Covers:
*   Mocking strategies (Electron, FS, Database).
*   Async testing do's and don'ts.
*   Performance benchmarking tips.

### [Debugging Guide](./testing/DEBUGGING.md)
Stuck on a failing test? Check this guide for common errors and solutions.
Covers:
*   "Electron not defined" errors.
*   Mocking `child_process`.
*   Database connection issues.

### [CI/CD Integration](./testing/CI_CD.md)
Overview of the GitHub Actions pipeline, pre-commit checks, and how to debug CI failures locally.

### [Neural Memory Testing](../../TESTING_GUIDE_V1.5.4.md)
Specific guide for verifying the Neural Memory enforcement system (v1.5.4+).

---

## 🧪 Quick Reference

| Type | Command | Location |
| :--- | :--- | :--- |
| **Unit/Integration** | `npm test` | `src/**/*.test.ts` |
| **Watch Mode** | `npm run test:watch` | N/A |
| **UI Mode** | `npm run test:ui` | N/A |
| **E2E (Build + Run)** | `npm run build && npm run e2e` | `e2e-tests/` |
| **Performance** | `npx vitest bench` | `src/__tests__/performance/` |

---

## 📂 Directory Map

*   `src/__tests__/`: Unit, Integration, and Performance tests.
*   `e2e-tests/`: Playwright End-to-End tests.
*   `docs/testing/`: Detailed documentation (you are here).
