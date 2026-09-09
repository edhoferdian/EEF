# Test Design Checklist — Edge Cases & Anti-Patterns

Harvested selectively: this
skill's own TEST → IMPLEMENT → VERIFY stages (`execution-loop.md`) already
enforce a stricter test-first discipline than the source `tdd-guide`
workflow — that part is not re-ported. What's genuinely missing and worth
reusing is the concrete edge-case checklist and the anti-pattern list below.
The source's "Eval-Driven TDD Addendum" (pass@1/pass@3 scoring) is
deliberately **not** ported — it's coupled to an external eval harness this
ecosystem has no equivalent of.

Referenced from Stage 2 (TEST) of `execution-loop.md` and from Gate 5 of the
per-task Reflection block.

## 8-category edge-case checklist

When writing the failing test in TEST, check the acceptance criteria against
each of these categories. Not every category applies to every task — but the
absence of one should be a conscious call, not an oversight.

1. **Null / undefined** input
2. **Empty** collections (arrays, strings, objects, result sets)
3. **Invalid types** passed where a specific type is expected
4. **Boundary values** (min/max, off-by-one, zero, negative where unexpected)
5. **Error paths** (network failures, DB errors, timeouts — not just the happy path)
6. **Race conditions** (concurrent operations, out-of-order async completion)
7. **Large data** (behavior/performance with 10k+ items, not just a handful)
8. **Special characters** (Unicode, emoji, SQL meta-characters, other injection-shaped input)

## 4 test anti-patterns to avoid

1. **Asserting implementation details instead of behavior** — a test that
   breaks when internal structure changes but the observable behavior didn't
   is testing the wrong thing.
2. **Shared mutable state between tests** — tests that depend on execution
   order or leak state to each other are not really independent tests.
3. **Assertions that don't actually verify anything meaningful** — a test
   that passes regardless of whether the code is correct is worse than no
   test, because it looks like coverage.
4. **Unmocked external dependencies causing flakiness** — a test that fails
   intermittently because it hit a real network call, a real clock, or a real
   external service is not a reliable signal.

## pytest-specific

When the project's test
runner is pytest, tie the categories and anti-patterns above to these
concrete mechanisms rather than leaving them abstract:

- **Fixture scope discipline.** A fixture's scope (`function` — default,
  `class`, `module`, or `session`) controls how often it's torn down and
  re-created. The wrong scope is a common source of the "shared mutable
  state between tests" anti-pattern above: a `session`- or `module`-scoped
  fixture that returns a mutable object (a list, a dict, a DB connection with
  mutable state) leaks whatever one test did to it into the next test that
  requests the same fixture instance. Default to `function` scope; widen it
  only for genuinely expensive, read-only, or explicitly-reset resources —
  and if widened, be explicit about what resets state between tests.
- **`pytest.mark.parametrize` for boundary values.** The "boundary values"
  category in the 8-category checklist above (min/max, off-by-one, zero,
  negative where unexpected) maps directly onto
  `@pytest.mark.parametrize("input,expected", [...])`: encode each boundary
  case as one row instead of one hand-written test per case, and use the
  `ids=[...]` parameter so a failing boundary shows up by name, not by tuple
  index.
- **`monkeypatch` / `unittest.mock` for unmocked external dependencies.** The
  "unmocked external dependencies causing flakiness" anti-pattern above is
  fixed concretely with pytest's built-in `monkeypatch` fixture (for
  environment variables, attributes, and `sys.path`/dict entries scoped to
  the single test) or `unittest.mock.patch`/`Mock` (for replacing a function,
  method, or object with a controllable stand-in and asserting on how it was
  called). A test that reaches a real network call, a real clock, or a real
  external service where one of these would have worked is the anti-pattern,
  not an acceptable trade-off.
- **`pytest.ini` / `conftest.py` for shared setup.** Project-wide markers,
  test discovery paths, and default CLI options belong in `pytest.ini` (or
  the equivalent `[tool.pytest.ini_options]` table in `pyproject.toml`).
  Fixtures shared across multiple test files belong in `conftest.py` at the
  appropriate directory level (closer to the tests that need them, not
  automatically at the repo root) so they're available without an explicit
  import and so their scope is visible from directory structure alone.

## Shared test-data generation

One item drawn from Django/DRF testing practice — applies to Django/DRF
projects, but the underlying call generalizes to any ORM-backed test suite:

- **Prefer `factory_boy` factories over a shared fixture file for test data.**
  A hand-maintained fixture file (a JSON/YAML fixture, or a single
  `conftest.py` object reused across many tests) is itself a form of the
  "shared mutable state between tests" anti-pattern above once more than a
  couple of tests start mutating the same loaded object. A `factory_boy`
  `DjangoModelFactory` (or an equivalent factory for another ORM) generates a
  fresh, independent object per call — `ProductFactory(price=100)`,
  `UserFactory.create_batch(10)` — with sequences/`Faker` fields avoiding
  hardcoded collisions, and `SubFactory`/`post_generation` handling related
  objects without a hand-wired fixture graph. Use this as the default for new
  test data; reserve a literal fixture file for data that is genuinely static
  and read-only across the whole suite.

## How this is used

- **Stage 2 (TEST)**: before writing the failing test, scan the 8 categories
  against the task's acceptance criteria. Note which apply and which are
  deliberately out of scope for this task (and why) — don't silently skip a
  category that clearly applies.
- **Gate 5 of the Reflection block** ("Error handling & edge cases present?")
  is checked against this list specifically, not left to vague judgment: a
  PASS on Gate 5 means the applicable categories from this checklist were
  actually covered, and a FAIL names which category was missed.
- When reviewing a test file (Stage 4 REVIEW), check it against the 4
  anti-patterns above before trusting that "tests pass" means the code is
  correct.
