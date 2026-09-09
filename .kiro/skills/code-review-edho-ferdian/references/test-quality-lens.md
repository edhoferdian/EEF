# Domain 5 — Test Quality (TQ)

This domain reviews whether the tests that exist (or should exist) for the
change set actually cover the behavior that changed — not just whether a test
file was touched. It runs alongside Domains 1–4 in Phase 1, using the same
evidence and confidence-labeling rules as the rest of this skill.

**When it applies:** any change set that adds or modifies behavior. If the
change is pure config, docs, or type-only, note that TQ is not applicable
rather than forcing findings.

---

## Ground-truth instruction (read before scoring TQ)

Do not eyeball test coverage. Before labeling anything **[High confidence]**:

1. **Run the actual test suite** for the changed files/module (use whatever
   the repo's tooling is — `npm test`, `pytest`, `go test`, etc., per the
   Phase 0 tooling probe).
2. **Run the coverage tool** if one exists (`--coverage`, `c8`, `coverage.py`,
   `go test -cover`, etc.) and read the actual line/branch numbers for the
   changed files.
3. Only claim a coverage gap, a passing-but-weak test, or a flaky pattern as
   **[High confidence]** when tool output backs it. Reasoning from reading the
   test file alone, without running it, caps the finding at
   **[Medium confidence]**.

If no test runner or coverage tool is available in the repo, say so explicitly
and cap every TQ finding at Medium/Low confidence — this is a real limitation
of the review, not a detail to skip past silently.

---

## TQ-01 — Behavioral mapping

For every changed function, method, or component, confirm a test exists that
actually exercises it — not just a test file that happens to import the
module.

- Map changed functions/classes to the tests that cover them (name the test
  file + test name, not just "there are tests").
- A changed function with zero covering tests is a gap, regardless of overall
  file/module coverage percentage.
- New public API surface (exported function, new endpoint, new component
  prop) without a corresponding test is a gap by default.

## TQ-02 — Edge-case and error-path coverage

- Are the edge cases created by *this* change tested (empty input, boundary
  values, null/undefined, the new branch introduced by the diff)?
- Are the error paths tested — not just the happy path? A function that can
  throw or reject needs at least one test asserting the failure behavior.
- Are important integration points covered (the change's interaction with
  the rest of the system), not just the unit in isolation?

## TQ-03 — Assertion strength

Flag tests that run code but don't actually verify its behavior. The
canonical weak pattern is the `expect(fn).not.toThrow()`-class assertion —
it proves the code didn't crash, not that it did the right thing. Also flag:

- Assertions on the wrong thing (e.g. asserting a mock was called, not that
  the observable output is correct, when the output is what matters).
- Snapshot tests with no accompanying explanation of what the snapshot is
  supposed to guarantee.
- Tests that assert `result).toBeDefined()` / `toBeTruthy()` where a specific
  value assertion is possible and would actually catch a regression.

## TQ-04 — Flakiness

Look for tests whose pass/fail depends on something other than the code
under test:

- **Time dependence** — real timers, `Date.now()`/`new Date()` without
  mocking, sleep-based waits instead of deterministic awaits.
- **Order dependence** — shared mutable state between tests, tests that only
  pass in a specific run order, missing `beforeEach`/`afterEach` cleanup.
- **Network dependence** — real HTTP calls to external services instead of
  mocks/fixtures, tests that fail offline or under rate limiting.

## TQ-05 — Isolation and naming

- Does each test set up its own state rather than depending on a previous
  test's side effects?
- Do test names describe the behavior under test (`returns empty array when
  no markets match query`) rather than the implementation (`test1`, `it
  works`)? Match the naming convention already documented in
  `rules/common/testing.md` if the repo follows it.
- Is teardown present where tests touch shared resources (files, DB rows,
  global state)?

## TQ-06 — Coverage-vs-behavior divergence

The sharpest gap this domain exists to catch: **high coverage percentage with
no behavioral assertion.** A line can be "covered" by a test that runs it and
asserts nothing meaningful about the result (see TQ-03). When coverage tool
output shows a changed file at or near 100% but the corresponding tests are
weak per TQ-03, report the divergence explicitly — the percentage is
misleading the team, not confirming safety.

---

## Reflection-gate question for this domain

Before finalizing any TQ finding, add this question to the Phase 3 reflection
pass (`references/reflection-critique.md`):

> "Am I flagging a missing test for behavior that's genuinely untestable at
> this layer (I/O boundary, third-party API, browser-only API without a test
> environment)? If so, downgrade to Info — note it as a coverage limitation,
> not a defect."

This prevents TQ from generating noise against boundaries the team has
already made a reasonable call not to unit-test (e.g. a thin wrapper around a
third-party SDK call that's covered by an integration/e2e layer instead).

---

## Severity mapping

Use the same five-level scale as the rest of the skill
(`references/review-checklist.md` §5):

- 🔴 **CRITICAL** — a changed code path with zero test coverage that handles
  money, auth, or destructive operations (delete, payment, permission grant).
- 🟠 **HIGH** — a changed function with no covering test, or an existing test
  that would pass even if the new logic were deleted (assertion too weak to
  catch a regression).
- 🟡 **MEDIUM** — missing edge-case/error-path coverage on non-critical logic.
- 🔵 **LOW** — naming/isolation nits that don't affect correctness detection.
- ⚪ **INFO** — coverage-vs-behavior divergence worth noting but not blocking,
  or an untestable-boundary note from the reflection gate above.
