# Handoff with dev-kickoff-edho-ferdian

Reference for the scope note in `e2e-testing-edho-ferdian`'s SKILL.md.

## Why this file exists

`dev-kickoff-edho-ferdian`'s execution loop is unit-level by design — one
RED test per acceptance criterion, fast, deterministic, no browser. That's
correct for most tasks, but it deliberately has a gap: its TEST-stage
escape-hatch table (`references/execution-loop.md` in that skill) lists
this row:

| Situation | What to do instead |
|-----------|--------------------|
| Visual or layout work | Skip automated TEST; define the visual acceptance check and screenshot/inspection step |

That row is a **placeholder for a real check**, not permission to skip
verification. This skill is the "instead" — the concrete visual/flow
verification dev-kickoff defers to rather than defining itself, keeping the
two skills at the altitude each is good at (unit correctness vs. real
browser behavior).

## Handoff direction 1 — dev-kickoff hands off here

Trigger conditions, either is enough:

1. A task's acceptance criteria are fundamentally about **what the user
   sees or a multi-step flow**, not a pure function's return value (e.g.
   "user can complete checkout," "the dashboard renders the right layout on
   mobile").
2. dev-kickoff's TEST stage hits the "Visual or layout work" escape hatch.

What happens at handoff:

- dev-kickoff names the concrete flow(s) affected by the task (not "test
  the whole app") — this becomes a journey candidate for this skill's
  Phase 1.
- This skill runs Phase 0 (driver detection) → Phase 1 (map/prioritize the
  named flow, if not already covered by an existing journey) → Phase 2
  (author or extend a Page Object Model test) → Phase 3/4 (execute, capture
  artifacts on failure).
- The result (pass/fail + artifact location) becomes dev-kickoff's REVIEW
  and VERIFY evidence for that task — cite it the same way dev-kickoff
  cites lint/build/unit-test output: real tool output, not eyeballing a
  screenshot and calling it "looks fine."

## Handoff direction 2 — back to dev-kickoff

An E2E journey test can fail for two different reasons, and they route
differently:

- **UI wiring bug** (wrong selector target, a button that stopped being
  clickable, a race condition in the test itself) — fix inside this skill's
  own Phase 2/3 work. This is E2E-test maintenance, not a new feature task.
- **Actual business-logic bug** (checkout accepts an invalid discount code,
  a permission check that should block an action doesn't) — this is a real
  defect uncovered by the journey, and it does **not** get patched from
  inside an E2E run. Report it back as a new task for dev-kickoff's normal
  PLAN → TEST → IMPLEMENT → REVIEW → VERIFY → REMEMBER loop, with the E2E
  failure as the reproduction evidence. Patching business logic directly
  inside an E2E test run skips PLAN, TEST-first, and the decision-register
  discipline dev-kickoff exists to enforce — don't shortcut it just because
  the bug was found here.

## What this skill does not own

- Unit-level test coverage, RED→GREEN discipline, and the 8-category
  edge-case checklist — those stay with dev-kickoff's TEST stage and
  `test-design-checklist.md`.
- Deciding whether a task needs E2E coverage at all — that's dev-kickoff's
  call at PLAN time (or a direct user request); this skill executes once
  handed a flow, it doesn't go looking for tasks.
