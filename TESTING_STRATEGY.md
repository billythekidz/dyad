# Testing Strategy: Dyad Automation Framework

> "If it isn't automated, it doesn't exist."

## 1. Core Philosophy
This document outlines the strategy for ensuring the reliability, performance, and correctness of the Dyad platform. We adopt a **hostile testing approach**: we assume the code is broken until proven otherwise by a rigorous, automated gauntlet.

## 2. Testing Levels (The Pyramid of Chaos)

### Level 1: Unit & Component Tests (Vitest)
*   **Scope**: Individual functions, hooks, and UI components.
*   **Tools**: Vitest, React Testing Library.
*   **Target**: 80% coverage.
*   **Focus**:
    *   Utility functions (especially `src/lib`).
    *   Component rendering and state logic.
    *   Internationalization (i18n) helpers.
*   **See Also**: [Testing Best Practices](./docs/testing/BEST_PRACTICES.md)

### Level 2: Integration Tests (Vitest)
*   **Scope**: Interaction between components and hooks.
*   **Focus**:
    *   Data flow from API to UI.
    *   Game logic correctness (Rules engine).
    *   SEO metadata generation.

### Level 3: E2E Automation (Playwright)
*   **Scope**: Critical user journeys running against a production-like build.
*   **Browser Coverage**: Chromium, Firefox, WebKit.
*   **Key Scenarios**:
    *   **Smoke Suite**: App load, navigation, locale switching.
    *   **Game Flow**: Selecting a game, reading rules, interacting with game tabs.
    *   **Neural Memory/AI**: Verifying AI response placeholders (mocked vs. real).

### Level 4: Performance & Load Testing (Vitest Bench + Custom)
*   **Scope**: Benchmarking critical paths and stress testing internal queues.
*   **Tools**: Vitest Bench, Custom Load Scripts.
*   **Scenarios**:
    *   **Micro-benchmarks**: `getActiveWindow` latency, `nmem` save speed.
    *   **Stress Tests**: `BackgroundSyncService` queue flooding (10k messages).

### Level 5: Visual Regression (Playwright + Percy/Argos)
*   **Scope**: Pixel-perfect UI verification.
*   **Focus**:
    *   Design system consistency.
    *   Responsive layout (Mobile vs. Desktop).
    *   Dark/Light mode regressions.

## 3. "Neural Memory" & AI Testing Strategy
Given the dependency on `DYAD_ENGINE`, we will implement a dual-strategy:
1.  **Mocked AI Responses**: For standard CI runs to ensure UI handles generic AI responses correctly without flakiness or cost.
2.  **Live AI Smoke Tests**: A scheduled suite that hits the staging `DYAD_ENGINE` to verify contract integration.

## 4. CI/CD Pipeline Integration
*   **Pre-commit**: Lint (`oxlint`), Format (`oxfmt`), Type-check.
*   **Pull Request**: Unit Tests, Smoke E2E Suite, Performance Baselines.
*   **Merge to Main**: Full Regression E2E, Visual Regression.
*   **Nightly**: Performance Audits (Lighthouse), Security Scans.

## 5. Directory Structure for Tests
```
tests/
  ├── e2e/
  │   ├── smoke/           # Fast, critical path tests
  │   ├── functional/      # Detailed feature tests
  │   ├── visual/          # Visual regression specs
  │   └── fixtures/        # Test data and page objects
  └── utils/               # Test helpers
src/
  ├── __tests__/           # Unit, Integration, and Performance tests
      ├── integration/     # Integration tests
      ├── performance/     # Benchmarks (*.bench.ts) and Load Tests
      └── ...              # Unit tests collocated or in subdirs
playwright.config.ts
vitest.config.ts
```

## 6. Documentation
For detailed guides on writing and running tests, see:
*   [Contributor Guide](./docs/testing/CONTRIBUTING.md)
*   [Best Practices](./docs/testing/BEST_PRACTICES.md)
*   [Debugging Guide](./docs/testing/DEBUGGING.md)
