# CI/CD Integration Guide

This guide outlines how Dyad's testing suite integrates with our CI/CD pipeline (GitHub Actions).

## 🚀 Pipeline Stages

### 1. Pre-Commit (Local)
Runs via `husky` and `lint-staged`.
*   **Lint**: `oxlint` (fast)
*   **Format**: `oxfmt` (fast)
*   **Type Check**: `tsc --noEmit`
*   **Unit Tests**: Related to changed files (optional/future)

### 2. Continuous Integration (GitHub Actions)
Runs on every Pull Request.

#### Job: `validation`
*   **Checkout**: Source code
*   **Setup**: Node.js 20, pnpm
*   **Install**: `pnpm install --frozen-lockfile`
*   **Lint & Format Check**: Ensure code quality
*   **Type Check**: Ensure no TS errors
*   **Unit Tests**: `npm test` (Vitest)
    *   Mocks external dependencies (Electron, DB)
    *   Uploads coverage report

#### Job: `smoke-tests`
*   **Build**: `npm run pre:e2e` (Builds Electron app)
*   **Smoke Suite**: `npm run e2e:smoke` (Playwright)
    *   Verifies app launch
    *   Verifies navigation
    *   Verifies "Golden Path" (Game Load)
*   **Artifacts**: Uploads trace files and screenshots on failure

### 3. Continuous Delivery (Merge to Main)

#### Job: `full-regression`
*   **Full E2E**: Runs all Playwright specs
*   **Visual Regression**: Runs Argos/Percy checks
*   **Performance**: Runs `vitest bench` to check for regressions in critical paths
    *   Fails if `getActiveWindow` > 50ms (p95)

---

## 🛠️ Configuration

### GitHub Workflows
*   `.github/workflows/ci.yml`: Main validation workflow
*   `.github/workflows/release.yml`: Build and publish logic

### Environment Variables
The following secrets must be set in GitHub:
*   `DYAD_ENGINE_URL`: URL for the staging AI engine
*   `PERCY_TOKEN` / `ARGOS_TOKEN`: For visual regression
*   `GH_TOKEN`: For releasing artifacts

---

## 🏃 Running CI Locally

You can simulate the CI environment using [act](https://github.com/nektos/act) or by running the commands in sequence:

```bash
# 1. Validation
npm run lint
npm run fmt:check
npm run ts

# 2. Unit Tests
npm test

# 3. Build & Smoke
npm run pre:e2e
npx playwright test --project=chromium --grep "@smoke"
```
