---
name: production-readiness-fanout-edho-ferdian
description: >-
  Parallel-fan-out-then-aggregate recipe for deployment-ops-edho-ferdian's
  Step 4 production-readiness verdict. Use whenever the ship/block score
  needs to consult all four risk lenses (security, data-layer, e2e
  coverage, performance) — not for a quick informal gut-check where the
  user just wants a rough read, not a scored verdict.
agents:
  - security-review-edho-ferdian
  - data-layer-patterns-edho-ferdian
  - e2e-testing-edho-ferdian
  - performance-audit-edho-ferdian
---

# Production-Readiness Fan-Out — Edho Ferdian Mode

A parallel-then-aggregate shape, reusing four agents that already exist in
this ecosystem for their own standalone purposes — no new agents needed
here, just a named recipe for consulting all four at once instead of one
after another. Same relationship to `deployment-ops-edho-ferdian`'s Step 4
that `research-fanout-edho-ferdian` has to `research-ops-edho-ferdian`'s
Phase 2.

## Stages

1. **Fan out** (parallel) — delegate to all four risk-lens agents at once:
   `security-review-edho-ferdian` (auth, secrets, injection, rate
   limiting), `data-layer-patterns-edho-ferdian` (migration reversibility,
   tenancy, idempotent writes), `e2e-testing-edho-ferdian` (launch-critical
   path coverage), `performance-audit-edho-ferdian` (latency/budget
   breaches). Scope each delegation to "assess risk in your domain for
   this release," not "fix anything you find" — Step 4 wants findings to
   score, not a set of unrelated changes to the codebase mid-audit.
2. **Aggregate** (main thread, or the `deployment-ops-edho-ferdian` agent
   itself) — apply `references/production-readiness.md`'s score bands and
   hard caps to the four returned findings sets, and produce the one-
   sentence verdict plus the Blockers / High-value fixes / Evidence
   checked / Evidence missing / Next action breakdown.

## Execution shape

- All four lenses are independent of each other — a security finding
  doesn't change what the e2e lens looks for, and vice versa — so there is
  no reason to run them sequentially on a harness that can parallelize.
- Stage 2 waits for **all four** before scoring. A verdict computed from
  three of four lenses (one delegate still running, or one silently
  skipped) is not a partial verdict, it's a wrong one — the score bands
  and hard caps assume full coverage.
- If a lens agent can't complete (no tooling available for its domain,
  scope genuinely doesn't apply — e.g. no database in this project),
  record it under "Evidence missing," not under a score as if it had
  passed clean.

## Harness realization

- **Claude Code**: real parallel delegation —
  `deployment-ops-edho-ferdian`'s own agent form carries `Agent` in its
  `tools:` for this.
- **A harness with delegation but unverified nesting, or none at all**:
  consult the four lenses sequentially in one context instead. Same four
  questions, same aggregation rule, just not concurrent.

## Provenance

New to this ecosystem (no ECC origin) — generalized from
`deployment-ops-edho-ferdian`'s own "Delegation, not duplication" table in
`references/production-readiness.md`, which already named the four lenses
but left "how" (sequential read vs. parallel delegation) unstated. Same
naming pattern as `review-then-verify-edho-ferdian` and
`research-fanout-edho-ferdian` — a reusable recipe, not skill-specific
prose repeated inline.
