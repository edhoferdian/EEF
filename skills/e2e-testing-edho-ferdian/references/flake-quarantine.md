# Flake Quarantine Protocol (Phase 3)

Reference for Phase 3 of `e2e-testing-edho-ferdian`. Adapted from ECC
`e2e-runner`, fetched 2026-09-04, with the quarantine mechanics made
explicit — the source material named the practice but not the procedure.

## The problem this solves

A flaky E2E test (fails intermittently, no code change) has two bad default
outcomes, both common:

1. **It blocks CI forever** — the team eventually starts re-running the
   pipeline until it goes green, which trains everyone to ignore red builds.
2. **It gets silently deleted or `.skip`'d with no note** — the coverage
   gap disappears from visibility and nobody remembers to restore it.

Quarantine is the third option: the test is disabled from blocking, but
**stays visible and tracked** until someone deliberately resolves it.

## Step 1 — Confirm it's actually flaky

Before quarantining, rule out a real bug wearing a flake costume:

```bash
npx playwright test path/to/test.spec.ts --repeat-each=10
```

- **Fails every time** → not flaky, it's broken. Fix it or the code it
  tests; don't quarantine a consistent failure.
- **Fails intermittently (e.g. 2/10, 4/10)** → genuinely flaky. Proceed to
  quarantine.

Common root causes to check before assuming it's unfixable: race conditions
(missing an explicit wait — fix with the waiting rules in
`journey-design.md` before quarantining), network timing (add a
`waitForResponse`), animation/transition timing (wait for the settled state,
not a fixed delay), test-order dependency (isolate the test's data setup).
A flake that's fixable this way should be fixed, not quarantined — quarantine
is for genuine non-determinism you can't yet pin down, not a shortcut around
writing a proper wait.

## Step 2 — Quarantine with a tracking note

Mark it skipped, with a note that survives without needing anyone to
remember context:

```typescript
test.fixme(
  'checkout: applies discount code before payment',
  // QUARANTINED 2026-09-04 — intermittent timeout on discount API call,
  // ~30% fail rate over 10 reruns. Tracking: TASK-E2E-014.
  // Owner: <whoever owns this journey>. Review by: 2026-09-18.
);
```

If the framework's quarantine mechanism doesn't support an inline comment
well (or the team wants centralized visibility), also add one row to a
tracking table — in this ecosystem, that's
`/project-memory/02-gap-analysis.md`'s open-questions convention, or a
dedicated `quarantine-log.md` next to the test suite if the project has no
`project-memory/`:

| Test | Quarantined | Reason | Fail rate | Tracking | Review by |
|------|-------------|--------|-----------|----------|-----------|
| checkout: applies discount code | 2026-09-04 | Intermittent timeout on discount API | 3/10 | TASK-E2E-014 | 2026-09-18 |

## Step 3 — Review cadence

A quarantined test is not "handled" — it's a debt with a due date.

- Set a **review-by date** at quarantine time (a couple of weeks is a
  reasonable default; adjust to the team's release cadence).
- At review: either the root cause was found and fixed (un-quarantine,
  confirm 10/10 green, remove the tracking row), or it's still unresolved
  (extend the review date with a reason, don't silently let it lapse), or
  the flow it covers is gone/changed enough that the test should be deleted
  outright (delete it and the tracking row together — don't leave a stale
  row pointing at a deleted test).
- **Anti-pattern to flag:** a quarantine row with no review-by date, or one
  that's months past its review date with no update — that's the "silently
  ignored" failure mode this protocol exists to prevent, happening anyway.

## Success signal

- Flaky rate across the active (non-quarantined) suite stays low — if it's
  climbing, something systemic changed (shared test infra, environment
  timing) and deserves its own investigation, not five more quarantines.
- Quarantine list stays short and current, not a growing graveyard.
