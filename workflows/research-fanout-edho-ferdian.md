---
name: research-fanout-edho-ferdian
description: >-
  Parallel-fan-out-then-synthesize recipe for research-ops-edho-ferdian's
  comparison/decision-memo and landscape/deep-dive paths — the ones whose
  Phase 2 decomposes a topic into several genuinely independent
  sub-questions. Use when a research task has enough sub-questions to
  benefit from real parallelism, not for a quick-factual or local lookup
  (those stay single-pass, no fan-out).
agents:
  - research-worker-edho-ferdian
  - research-fact-checker-edho-ferdian
---

# Research Fan-Out — Edho Ferdian Mode

A parallel-then-synthesize shape: N independent sub-questions researched
concurrently, one synthesis pass over all of them, one independent audit
of the synthesized claims. This generalizes `research-ops-edho-ferdian`'s
own Phase 2/5 split into a named, reusable recipe — the same relationship
`review-then-verify-edho-ferdian` has to `code-review-edho-ferdian`'s
Critique-Correction Loop.

## Stages

1. **Classify & decompose** (main thread) — `research-ops-edho-ferdian`'s
   Phase 0/1 (start from what's given, classify the ask, pick the
   lightest path) and Phase 2 step 1 (break into 3-5 sub-questions). Stays
   in the orchestrating context; there is nothing to parallelize yet.
2. **Fan out** (parallel) — delegate one `research-worker-edho-ferdian`
   per sub-question, all at once, not sequentially. Each worker returns
   labeled, cited findings for its own sub-question only.
3. **Synthesize** (main thread) — Phase 3 (cross-check) and Phase 4
   (report) run once, over every worker's returned findings together.
   Synthesis needs the full picture, so this stage is not itself
   parallelized or delegated — only the search that feeds it was.
4. **Audit** (delegated) — after Phase 4 produces a draft, delegate to
   `research-fact-checker-edho-ferdian` for an independent citation check
   before Phase 5's reflection gate is treated as complete.

## Execution shape

- Stage 2 is N-way parallel; all workers can run concurrently since their
  sub-questions are independent by construction (that's what "decomposed"
  means — if two sub-questions turn out to depend on each other, that's a
  sign Phase 1's decomposition needs revising, not that the workers should
  share context).
- Stage 3 waits for **all** of Stage 2 before starting — a synthesis run
  on partial results silently under-answers the topic.
- Stage 4 runs once, after Stage 3, not per-worker — auditing each
  worker's raw findings individually would miss cross-source
  contradictions that only appear once everything is synthesized together.

## Harness realization

- **Claude Code**: real parallel delegation for Stage 2 and a real
  independent delegate for Stage 4 (`research-ops-edho-ferdian`'s own
  agent form carries `Agent` in its `tools:` for this).
- **A harness with delegation but unverified nesting, or none at all**:
  run Stage 2's sub-questions sequentially in one context and Stage 4's
  audit as a self-check within Phase 5 — same shape, weaker isolation.
  State which mode was used in the final report, same honesty rule
  `research-ops-edho-ferdian` already applies to search-surface
  availability.

## Provenance

New to this ecosystem (no ECC origin) — generalized from
`research-ops-edho-ferdian`'s own Phase 2 decomposition and Phase 5
reflection gate, following the same "name the recipe, don't just describe
it inline" pattern `review-then-verify-edho-ferdian` established first.
