# Playwright Configuration, Layout & CI (driver-specific reference)

Read this **only** when
Phase 0 detected the project's own `@playwright/test` as the driver. The
process in Phases 1–4 is driver-agnostic; this file is the concrete Playwright
wiring behind it.

## Suite layout

```
tests/
├── e2e/
│   ├── auth/          login.spec.ts, logout.spec.ts, register.spec.ts
│   ├── features/      search.spec.ts, checkout.spec.ts
│   └── api/           endpoints.spec.ts
├── pages/             one Page Object per screen (Phase 2)
├── fixtures/          auth.ts, data.ts
└── playwright.config.ts
```

Directory names mirror the Phase 1 journey priorities — a HIGH journey should
be findable by name, not buried in one `spec.ts` per app.

## Baseline config

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,        // a stray test.only must fail CI, not narrow it
  retries: process.env.CI ? 2 : 0,     // retries reveal flakes; they do not fix them
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'playwright-results.xml' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
    { name: 'mobile',   use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

The `use` block above is what makes Phase 4's artifact rules automatic —
failure-only capture, no green-run video. Do not set `screenshot: 'on'` or
`video: 'on'` "temporarily"; it is exactly the drowning-in-artifacts failure
mode Phase 4 warns about.

## Quarantine mechanics (Phase 3 protocol, Playwright syntax)

```ts
test('checkout: applies discount code', async ({ page }) => {
  test.fixme(true, 'QUARANTINED 2026-09-04 — 3/10 timeout on discount API. TASK-E2E-014. Review by 2026-09-18.');
});

test('heavy dashboard load', async ({ page }) => {
  test.skip(!!process.env.CI, 'Flaky in CI only — TASK-E2E-021');
});
```

Flake confirmation before quarantining (Phase 3 Step 1):

```bash
npx playwright test tests/e2e/features/search.spec.ts --repeat-each=10
```

## CI workflow

```yaml
name: E2E
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
        env:
          BASE_URL: ${{ vars.STAGING_URL }}
      - uses: actions/upload-artifact@v4
        if: always()                    # artifacts matter most when the job failed
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

Remember the native-OS rule in `journey-design.md`: an `ubuntu-latest` job
proves Linux behavior only. Path separators, filesystem case-sensitivity and
shell quoting need a real macOS/Windows runner in the matrix.

## Run report template

```markdown
# E2E Run — <date> — <driver> — <environment>
Total: X | Passed: Y | Failed: Z | Flaky: F | Quarantined: Q | Duration: Xm Ys

## Failures
### <test name>
File: tests/e2e/<path>:<line>
Error: <assertion message>
Artifacts: screenshot / video / trace paths
Suspected cause: <one line>

## Quarantine changes this run
<added / removed / review-date extended — or "none">
```

## Two flow types that need extra care

**Wallet / web3 flows** — inject a mock provider before the page loads instead
of driving a real extension:

```ts
await context.addInitScript(() => {
  (window as any).ethereum = {
    isMetaMask: true,
    request: async ({ method }: { method: string }) =>
      method === 'eth_requestAccounts'
        ? ['0x1234567890123456789012345678901234567890']
        : method === 'eth_chainId' ? '0x1' : undefined,
  };
});
```

**Money-moving flows** — a HIGH journey by Phase 1's ranking, and the one place
where a test run itself is dangerous. Guard it so it can never execute against
production, and wait on the real settlement response rather than a fixed delay:

```ts
test('trade execution', async ({ page }) => {
  test.skip(process.env.NODE_ENV === 'production', 'never execute trades against production');
  // ... drive the flow ...
  await page.waitForResponse(r => r.url().includes('/api/trade') && r.status() === 200, { timeout: 30_000 });
});
```

This pairs with the blast-radius rule in `qa-sweep.md`: mutating journeys run
against staging with seeded test accounts, never against production with real
credentials.
