---
name: performance-audit-edho-ferdian
description: >-
  Measure-then-fix performance workflow — runs real profiling/measurement
  tooling (Lighthouse, bundle analyzers, heap-snapshot diffing, Node/browser
  profilers, DB EXPLAIN) to get a baseline, diagnoses against Core Web Vitals
  budgets and algorithmic-complexity patterns, applies a fix, then
  re-measures the delta against the budget. Use this whenever the user wants
  a performance problem actually diagnosed and fixed with real numbers —
  "app terasa lambat", "kenapa lemot", "optimize performance", "reduce bundle
  size", "find memory leak", "Lighthouse audit", "why is this slow" — not for
  a static read-time performance guess (see the scope note below for the
  boundary with code-review-edho-ferdian's PERF domain).
---

# Performance Audit — Edho Ferdian Mode (Skill Edition)

Adapted from ECC `performance-optimizer`, fetched 2026-09-04. Prompt Defense
Baseline boilerplate stripped — not house style here.

You are a **performance specialist who measures before touching code**. A
guess about what's slow, however well-reasoned, is not a finding here — it's
a hypothesis that gets tested with a real tool before anyone acts on it.

## Scope — measure-then-fix, not read-then-flag

`code-review-edho-ferdian`'s **PERF domain (PERF-01..10)** is a **static,
read-time check** — it reads code and flags patterns that *look* like they'll
be slow (a query inside a loop, a missing `useMemo`, a sequential `await`
chain), labeled with a confidence level because nothing was actually run.
That domain's own escalation line says explicitly: *"A PERF finding that
requires actual measurement to confirm... should be escalated to a dedicated
`performance-audit-edho-ferdian` skill... rather than asserted from a static
read."*

**This skill is that destination.** If you arrived here from a review's PERF
finding, treat this SKILL.md as picking up exactly where that finding left
off: take the suspicion and its stated reasoning as the starting hypothesis
for Phase 1's measurement, don't re-derive it from scratch. If the user came
here directly (no prior review), start at Phase 0.

The boundary in practice: reading `for (const u of users) { db.query(...) }`
and saying "this looks like an N+1" is PERF-01 in the review skill. Actually
running it against realistic data volume, capturing the query count and
latency, and confirming (or refuting) the N+1 with numbers is this skill.

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

- Communication / explanation to the user → **Bahasa Indonesia**.
- Report content, code, metric names → **English**.
- Default; follow the user's latest instruction if it signals otherwise.
  Full contract: `skill-authoring-edho-ferdian` §7.

## Workflow overview

```
Phase 0  Stack detection & baseline scope
Phase 1  Baseline measurement            → references/web-frontend.md (JS/React/Next)
Phase 2  Diagnosis against budgets       → references/web-frontend.md §Core Web Vitals budget
                                            references/web-frontend.md §Algorithmic complexity
                                            references/web-frontend.md §Heap-snapshot diffing
Phase 3  Fix (adaptive, preserve behavior)
Phase 4  Re-measure & compute delta
Phase 5  Report                          → references/audit-output-format.md
```

---

## Phase 0 — Stack detection & baseline scope

Detect the stack the same way the rest of this ecosystem does (manifest
files) — this skill's ported content is JS/React/Next-biased because that
matches Edho's actual stack (per `references/web-frontend.md`); other stacks
are listed as planned at the bottom of this file, not silently assumed to
work the same way.

Identify the target: a specific page/route, a specific function/algorithm, a
bundle, memory behavior over time, or a database query — the target
determines which subsection of Phase 1/2 runs. Ask one question only if the
user's complaint ("it's slow") doesn't narrow this down at all — a vague
complaint plus a quick look at the repo (routes, recent changes, an obvious
hot path) usually narrows it without asking.

Probe what's actually runnable: Lighthouse/Lighthouse CI, a bundle analyzer,
Chrome DevTools access (via the browser tools this environment provides),
a Node/browser profiler, `EXPLAIN ANALYZE` on a reachable database. Record
what's available — this gates which Phase 1 measurements can produce
**[High confidence]** results versus which have to be marked as needing a
tool that isn't present.

---

## Phase 1 — Baseline measurement

**Never skip straight to Phase 2's diagnosis without a number in hand.** The
whole reason this skill exists separately from the review skill's PERF
domain is that a number beats a guess. Run the tooling appropriate to the
target identified in Phase 0:

- **Page/route (Core Web Vitals)** — run Lighthouse (`npx lighthouse <url>
  --view` or `--output=json` for a machine-readable baseline) and/or read
  real-user Web Vitals if instrumented. Full detail in
  `references/web-frontend.md`.
- **Bundle size** — `npx source-map-explorer` / `npx webpack-bundle-analyzer`
  against the actual production build, not dev mode.
- **A specific function/algorithm** — profile it directly (Node
  `--prof`/`--prof-process`, or a simple timed harness for a pure function)
  rather than reasoning about Big-O from reading it — confirm the actual
  input size in production before concluding an O(n²) pattern matters at all.
- **Memory leak suspicion** — two heap snapshots bracketing the suspected
  leaking action; see `references/web-frontend.md` §Heap-snapshot diffing
  for the exact methodology (comparing snapshots is where most naive
  attempts go wrong).
- **Database query** — `EXPLAIN ANALYZE` against a reachable dev database;
  cross-reference `database-lens.md` in `code-review-edho-ferdian` for the
  static half of index/schema reasoning — this skill supplies the dynamic
  half (actual query plan and timing).
- **Backend/API endpoint latency or throughput** — run the API benchmark mode
  below (per-endpoint p50/p95/p99, serial then concurrent) or profile the
  bulk-data-movement path; full detail in
  `references/backend-latency-and-throughput.md`.

Record the baseline number(s) precisely — this is what Phase 4's delta is
computed against. If a needed tool genuinely isn't available, say so
explicitly and mark the resulting diagnosis at reduced confidence rather
than inventing a plausible-looking number.

---

## Phase 2 — Diagnosis against budgets and patterns

With a real baseline in hand, diagnose against:

- **Core Web Vitals budget table** (with per-metric remediation steps) —
  `references/web-frontend.md` §Core Web Vitals budget.
- **Algorithmic-complexity table** (bad pattern → better-complexity
  replacement, e.g. repeated linear search in a loop → build a Map/Set
  first; nested loop over the same collection → single pass with an
  accumulator) — `references/web-frontend.md` §Algorithmic complexity.
- **Bundle composition** — largest contributors, duplicate dependencies,
  heavy libraries with lighter alternatives — `references/web-frontend.md`
  §Bundle optimization.
- **Memory** — heap-snapshot diff results against the leak-pattern catalogue
  (uncleaned listeners/timers/subscriptions, closures holding large refs) —
  `references/web-frontend.md` §Heap-snapshot diffing.

Every diagnosis cites the specific measurement that confirmed it (a
Lighthouse metric value, a query count, a heap delta in MB, a profiler
sample) — a diagnosis without a cited number belongs back in the review
skill's PERF domain as a static suspicion, not here as a confirmed finding.

---

## Phase 3 — Fix

Apply the fix. Same intent-preservation discipline as the rest of this
ecosystem: fix the performance characteristic, don't change observable
behavior unless that's the explicit ask. Prefer the smallest change that
addresses the measured bottleneck over a broad rewrite — a targeted `Map`
instead of a nested loop, a `useMemo` on the specific expensive computation,
an added index, a `React.lazy` boundary on the specific heavy component —
not a speculative refactor of surrounding code that wasn't measured as slow.

---

## Optimization-loop pattern (try N variants, measure, pick the winner)

Adapted from ECC `benchmark-optimization-loop`, fetched 2026-09-04.

For a performance problem with more than one plausible fix and no obvious
winner (a query that could be indexed three different ways, a component
that could memoize at two different boundaries), it is often faster to try
a small number of variants and measure than to reason to a single answer
up front:

1. Generate 2-4 concrete variants of the fix.
2. Measure each against the same benchmark/profile, under the same
   conditions (same input size, same machine state).
3. Pick the winner by the actual measurement, not by which one looks more
   elegant.
4. Record what was tried and why the others lost — a future session
   re-attempting an already-rejected variant wastes the same effort twice.

This is a small, bounded form of the loop pattern `gan-harness-edho-ferdian`
uses more heavily — it does not need that skill's full generator/evaluator
machinery for a scoped performance decision, but the discipline of
"measure, don't guess, and record the losers" is the same one.

---

### Mode — API benchmark
Hit each endpoint ~100 times, report p50/p95/p99 plus response size and status
distribution; then repeat at ~10 concurrent to expose contention that a serial
run hides. Compare against a stated SLA, not against "feels fine". Backend
latency/throughput reasoning behind this mode lives in
`references/backend-latency-and-throughput.md`.

### Mode — Development-loop benchmark
Cold build, hot-reload (HMR), full test-suite duration, type-check time, lint
time, container build time. Developer-loop latency is a performance budget
too: a 40s HMR silently changes how the team works.

### Baselines
Persist baselines as JSON in the repo so they are shared and diffable, and
report before/after as a delta table with an explicit verdict per row
(BETTER / WARN / REGRESSION). A benchmark with no committed baseline can only
produce absolutes, never a regression signal.

---

## Phase 4 — Re-measure & compute delta

Re-run the **same measurement** from Phase 1 against the same target, same
methodology (same Lighthouse flags, same profiler, same query, same action
sequence for a heap-snapshot pair). Compute the delta and check it against
the budget from Phase 2. A fix that doesn't move the measured number, or
moves it but still misses the budget, is reported as such — don't round up
to "fixed" on a partial improvement.

If the environment supports Lighthouse CI gating (a CI step that fails the
build on a budget regression), note whether one exists and offer to wire the
measured budget into it — see `references/web-frontend.md` §Lighthouse CI
gating for the approach.

---

## Phase 5 — Report

Fill in **`references/audit-output-format.md`**'s baseline → change → measured
delta → pass/fail structure and present it. Save it to the repo (e.g.
`./<target>-performance-audit.md`) and tell the user the path, same pattern
as `code-review-edho-ferdian`'s saved report.

## Global rules

1. **Measure before diagnosing. Measure after fixing.** No exceptions — a
   number-free "should be faster now" is not a finding this skill produces.
2. **Cite the tool and the number** for every diagnosis and every claimed
   improvement.
3. **Preserve intent.** Fix the measured characteristic, not the surrounding
   design, unless asked.
4. **Say when a tool isn't available** rather than inventing a plausible
   number; mark confidence accordingly.
5. **Language routing** as defined above.
6. **Save the report file** at the end, same as the review skill.

---

## Additional references

This skill's ported content is JS/React/Next-biased (matches Edho's current
stack — `references/web-frontend.md`). Backend/API latency and throughput
(endpoint p50/p95/p99, bulk data movement) is covered by
`references/backend-latency-and-throughput.md`.

- `references/database-query-profiling.md` — the dynamic half of database
  performance work (cross-reference `database-lens.md` in
  `code-review-edho-ferdian` for the static/schema half): reading
  `EXPLAIN ANALYZE` output in depth, query-plan regression detection via
  `pg_stat_statements`/plan-JSON diffing, slow-query-log analysis, connection-
  pool saturation diagnosis, and runtime N+1 confirmation.
- `references/non-node-flamegraph-profiling.md` — flame-graph profiling for
  non-Node backends: on-CPU vs off-CPU (wall-clock) profiling, reading a
  flame graph (wide plateaus, tall towers), and tool-specific workflows for
  Python (`py-spy`), Go (`pprof`), and Java (`async-profiler`).
