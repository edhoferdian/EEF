# Artifact Strategy (Phase 4)

Reference for Phase 4 of `e2e-testing-edho-ferdian`.

## What to capture, and when

Artifacts exist to let someone diagnose a failure **without re-running it
blind**. Capture on failure, not on every run — a green suite that also
uploads video for every passing test wastes storage and CI time for no
diagnostic benefit.

| Artifact | When | Why |
|----------|------|-----|
| Screenshot | Every failure, always | Cheapest artifact, shows the exact DOM/visual state at failure |
| Video | Every failure, if the driver supports it | Shows the sequence leading up to the failure, not just the end state — critical for timing/race-condition bugs |
| Trace (Playwright trace viewer or equivalent) | Every failure, if the driver supports it | Full timeline: DOM snapshots, network, console, actions — the richest artifact, worth the extra size on failure-only |
| Console/network logs | Every failure | Cross-reference with the trace; catches errors that don't manifest visually |

Playwright config example (adjust for whichever driver Phase 0 detected):

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
});
```

For Claude's own browser tools (`mcp__Claude_Browser__*`), capture the
equivalent manually on a failing step: a `computer` screenshot action, plus
`read_console_messages` and `read_network_requests` output, attached to the
failure report — there's no built-in CI artifact pipeline to configure, so
this capture happens inline as part of reporting the failure.

## Naming and storage

- Name artifacts so a failure and its artifacts are unambiguously linked:
  `<test-name>-<timestamp>.png` / `.webm` / `.zip` (trace), not a bare
  `screenshot1.png`.
- Store under a dedicated, gitignored directory (e.g. `test-results/` or
  `playwright-report/` — whatever the driver's default is; don't relocate
  it without reason). In CI, upload this directory as a build artifact so
  it survives after the job ends — a local-only artifact is invisible to
  whoever triages a CI failure.
- Never commit artifacts to the repo. They're diagnostic output, not source.

## Retention

- CI artifact retention follows the CI platform's default unless a
  compliance/debugging reason says otherwise (e.g. keep failure artifacts
  for 30 days, enough to investigate a flaky-then-fixed report without
  keeping them forever).
- Local runs: clean the artifact directory between local test sessions to
  avoid confusing an old failure's screenshot with a new run's.

## Reporting

Generate a human-readable report alongside raw artifacts — an HTML report
(Playwright's built-in `show-report`) or equivalent — so a failure can be
triaged by clicking through screenshots/trace rather than reading raw logs
first. Link the report location in the E2E run's summary output.
