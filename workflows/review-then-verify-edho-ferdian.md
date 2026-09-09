---
name: review-then-verify-edho-ferdian
description: >-
  Two-stage review pipeline — a code-reviewer agent produces findings, then
  each finding is independently re-checked before being reported as
  confirmed. Use after a non-trivial implementation task, before merge, when
  the cost of a false-positive finding (wasted fix effort) or a missed
  finding (a real bug shipping) both matter enough to justify a second pass.
agents:
  - code-reviewer-edho-ferdian
---

# Review-Then-Verify — Edho Ferdian Mode

A minimal two-stage pipeline: one delegate produces findings, a second pass
adversarially checks each one before it counts as real. This is the same
shape as `code-review-edho-ferdian`'s own Reflection/Critique-Correction
Loop — this file generalizes it into a reusable, named workflow so other
skills (or a future orchestrator) can invoke the pattern by name instead of
re-describing it inline.

## Stages

1. **Review** — delegate to `code-reviewer-edho-ferdian` with the diff/file
   set in scope. Collect its findings list (evidence-backed, severity-
   labeled, per that agent's own format).
2. **Verify** — for each finding, delegate a second, independent check:
   "given this specific claim and the cited evidence, is it actually true
   in this codebase?" A verify pass sees only the one finding plus enough
   file context to check it — never the full findings list, so it cannot
   rubber-stamp out of trust in the first pass.
3. **Report** — keep only findings whose verify pass confirms them. Findings
   the verify pass rejects are dropped, not silently escalated or hidden —
   note the rejection count so the orchestrator knows the second stage did
   real work, not zero.

## Execution shape

- Stage 1 runs once. Stage 2 runs once per finding from Stage 1 — these can
  run in parallel with each other (they are independent), but Stage 2 as a
  whole must wait for all of Stage 1 to land first (pipeline, not full
  parallel) since verify needs a finding to check.
- If Stage 1 returns zero findings, skip Stage 2 entirely and report a clean
  pass — do not manufacture a verify step with nothing to verify.

## Harness realization

- **Claude Code / a harness with real sub-agent delegation**: Stage 1 is one
  delegate call to `code-reviewer-edho-ferdian`; Stage 2 is N parallel
  delegate calls (one per finding), each a fresh, scoped context.
- **A harness with only a single active agent** (no sub-agent primitive):
  run both stages as sequential phases of the same session instead of real
  delegation — read the code, produce findings, then re-read each finding's
  evidence a second time from a skeptical stance before reporting it. Same
  shape, lower isolation between the two passes.

## Provenance

New to this ecosystem (no ECC origin) — generalized from
`code-review-edho-ferdian`'s existing Critique-Correction Loop and from the
`pipeline()`/`parallel()` shape this environment's own Workflow tool uses,
written here as a portable, harness-agnostic recipe rather than a
tool-specific script.
