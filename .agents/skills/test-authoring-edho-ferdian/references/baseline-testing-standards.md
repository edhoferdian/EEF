# Baseline Testing Standards — Edho Ferdian Ecosystem

## Why this file exists

Same pattern as `baseline-conventions.md`
(D-032), `git-and-release-ops-edho-ferdian` (D-020), and
`networking-ops-edho-ferdian/references/design-principles.md` (D-024): the
ecosystem's baseline testing standards were still coming from a rule
file loaded as a global instruction every session. This file is the native
home for them, rewritten rather than copied.

The three-way boundary in this skill's SKILL.md still holds. This file owns
the *numbers and the loop* — thresholds, the RED/GREEN order, structure and
naming. It does not own how to judge an existing test (that is
`code-review-edho-ferdian/references/test-quality-lens.md`) or how to write
one in a specific stack (that is `references/react.md` and friends).

## 1. Coverage floor: 80%

80% line coverage is the floor for code that ships, not the goal. Three
qualifications that matter more than the number:

- **Coverage measures execution, not verification.** A test that runs a
  function and asserts nothing scores identically to one that pins its
  contract. Treat a coverage report as a map of what was never executed —
  that part is trustworthy — and never as evidence that what *was* executed
  is correct. TQ-06 in `test-quality-lens.md` is the check for this.
- **The floor is per-change, not per-repo.** A repo sitting at 62% does not
  license a new module at 62%. New and modified code meets the floor; the
  legacy remainder is a separate, tracked debt.
- **Some code is exempt and should be excluded explicitly**, not left to
  drag the average down: generated clients, migration files, thin DTO/type
  declarations, framework glue with no branches. Exclude them in the
  coverage config with a comment saying why, so the number stays honest.

Three layers are all required for a feature to count as tested:

| Layer | Covers | Fails when |
|---|---|---|
| Unit | one function/component in isolation | logic branches, edge values, error paths |
| Integration | a real seam — endpoint + DB, service + queue | contracts between layers drift |
| E2E | one critical user journey end to end | the journey a user actually performs breaks |

E2E is the thinnest layer by design — see `e2e-testing-edho-ferdian` for
which journeys earn one. A feature with 95% unit coverage and no integration
test across its own seam is not at 95%; it is untested where it will break.

## 2. The loop: RED → GREEN → REFACTOR

1. Write the test first.
2. **Run it and watch it fail.** A test that has never been red is not
   evidence of anything — it may be asserting a tautology, or not running at
   all. A "valid RED" fails for the reason the feature is missing, not
   because of an import error, a typo in the test name, or a misconfigured
   runner. If the failure message does not describe the missing behaviour,
   the test is wrong, not the code.
3. Write the smallest implementation that turns it green.
4. Run it and watch it pass.
5. Refactor with the test as the safety net.
6. Check coverage.

Stage 2 of `dev-kickoff-edho-ferdian/references/execution-loop.md` is this
loop wired into the per-task workflow; this section is the standalone
statement of it for work that is not running under that skill.

## 3. Structure: Arrange–Act–Assert

Three visually separated blocks, in that order, one behaviour per test.

```
// Arrange — set up the inputs and the world
// Act     — perform exactly one action
// Assert  — check exactly one behaviour
```

Two `Act` blocks in one test means two tests. A test that arranges, acts,
asserts, acts again, and asserts again cannot tell you which action broke
when it goes red.

## 4. Naming: describe the behaviour, not the function

The name is read in a failing CI log by someone who has not opened the file.
It must say what was expected.

- Good: `returns empty array when no markets match query`
- Good: `throws when API key is missing`
- Good: `falls back to substring search when Redis is unavailable`
- Bad: `test search`, `works correctly`, `handles errors`, `test case 2`

Rule of thumb: the name states the **condition** and the **expected
outcome**. If you cannot write it without the word "correctly", the test is
not yet about a specific behaviour.

## 5. When a test fails

Diagnose in this order — it is cheapest first, and skipping to step 4 is the
most common way to destroy a real signal:

1. **Isolation** — does it pass alone but fail in the suite? Then it is
   order- or state-dependent, and the *suite* is the bug: shared fixtures,
   an un-reset module, a leaked global, a real clock.
2. **Mocks** — is the mock still shaped like the thing it replaces? A mock
   that has drifted from the real signature makes a green suite meaningless.
3. **The implementation** — fix the code.
4. **The test** — change the test only when you can state, in one sentence,
   what it was asserting that was actually wrong. "The test is outdated" is
   not that sentence. Changing an assertion to match observed output is how
   a bug gets promoted into a specification.

## 6. Closing a coverage gap deliberately

When asked to raise coverage,
do not generate tests file-by-file down the report — that produces the
highest possible number for the lowest possible value.

1. Detect the runner and coverage tool from the project's own manifest, not
   from assumption (see `dev-kickoff-edho-ferdian/references/stack-verification.md`).
2. Read the report and rank uncovered code by **blast radius**, not by line
   count: auth and permission checks, money and quantity arithmetic, data
   mutation and deletion, error and retry paths, anything a bug has already
   been found in once.
3. Write tests for the top of that list, following §2–§4.
4. Re-run coverage and report the delta with the ranking, not just the
   number: "78% → 84%; the six new tests cover the permission check and the
   refund path. Still uncovered: the CSV export branch (low risk)."

Never report a coverage number you did not obtain from running the tool —
Stage 5 VERIFY in `execution-loop.md` applies here without exception.
