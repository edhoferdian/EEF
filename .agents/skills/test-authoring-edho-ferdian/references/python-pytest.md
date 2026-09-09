# Python / pytest — Authoring Guide

This is stack-specific detail for `test-authoring-edho-ferdian`'s SKILL.md.
Read the SKILL.md first for the three-way boundary against
`code-review-edho-ferdian`'s test-quality-lens, `dev-kickoff-edho-ferdian`'s
test-design-checklist, and `e2e-testing-edho-ferdian` — this file assumes
that boundary and only covers pytest-specific authoring mechanics.

---

## AAA structure in pytest idiom

pytest has no special Arrange-Act-Assert syntax — the structure is a
convention you keep by hand inside the function body. Keep the three phases
visually separated (a blank line between them is enough) so a reader can
scan a test in three seconds:

```python
def test_transfer_moves_funds_between_accounts():
    # Arrange
    sender = Account(balance=100)
    receiver = Account(balance=0)

    # Act
    transfer(sender, receiver, amount=40)

    # Assert
    assert sender.balance == 60
    assert receiver.balance == 40
```

Fixtures (below) are how you move a growing Arrange block out of the test
body when several tests share the same setup — but don't reach for a
fixture just to hide one line; a fixture used by only one test is usually
just the Arrange section in disguise, one level of indirection a reader now
has to jump to.

## Naming

Match the ecosystem-wide behavior-describing convention from
`baseline-testing-standards.md`: `test_<subject>_<condition>_<expected
outcome>`, e.g. `test_transfer_raises_when_balance_insufficient`, not
`test_transfer_2` or `test_transfer_error_case`.

---

## Fixtures

Fixtures are pytest's mechanism for shared, composable setup/teardown —
prefer them over a `setUp`/`tearDown` class method (the unittest-style
pattern) for anything beyond the simplest case, since fixtures compose via
function parameters instead of a single fixed lifecycle hook.

### Basic fixture and setup/teardown via `yield`

```python
import pytest

@pytest.fixture
def db_connection():
    conn = create_connection(":memory:")   # setup
    yield conn                             # provided to the test
    conn.close()                           # teardown, runs even if the test fails
```

The `yield` form is preferred over a fixture that only `return`s, whenever
teardown matters — code after `yield` runs during teardown, including when
the test raises, which is what makes it safe to open real resources
(a temp file, a DB connection, a subprocess) in a fixture at all.

### Fixture scope — pick the narrowest scope that's still correct

```python
@pytest.fixture              # function scope (default): fresh per test
def temp_file(): ...

@pytest.fixture(scope="module")   # once per test file
def module_db(): ...

@pytest.fixture(scope="session")  # once per test run
def shared_resource(): ...
```

Default to function scope. Widen the scope only for something genuinely
expensive to set up (spinning up a real database, starting a subprocess)
**and** safe to share — a session-scoped fixture that holds mutable state
read and written across tests reproduces the exact shared-mutable-instance
flake trap that `react.md`'s `QueryClient` section warns about for RTL: a
test's outcome starts depending on execution order. If a widened-scope
fixture must reset some piece of state between tests, pair it with a
function-scoped autouse fixture that does the reset, rather than assuming
tests won't interact.

### `conftest.py` for cross-file sharing

```python
# tests/conftest.py
import pytest

@pytest.fixture
def client():
    app = create_app(testing=True)
    with app.test_client() as c:
        yield c
```

Fixtures defined in `conftest.py` are visible to every test file in that
directory and below, with no import needed — this is the idiomatic way to
share setup across a test suite, not a shared module-level constant.

### Autouse fixtures — use sparingly

```python
@pytest.fixture(autouse=True)
def reset_config():
    Config.reset()
    yield
    Config.cleanup()
```

An autouse fixture runs for every test in its scope without being requested
by name, which is exactly what makes it easy to overuse: a reader looking at
a failing test's signature won't see that `reset_config` ran unless they
already know to check `conftest.py`. Reserve autouse for genuinely global
invariants (resetting a singleton config, silencing a noisy logger) — not as
a shortcut to avoid listing a fixture a specific test actually depends on.

---

## Parametrize

`@pytest.mark.parametrize` replaces a loop-inside-a-test-body or several
near-duplicate test functions with one test run N times — and, critically,
pytest reports each case as its own pass/fail, so one bad case doesn't hide
behind eight passing ones the way a manual loop with a single assert at the
end would.

```python
@pytest.mark.parametrize(
    "input_value,expected",
    [
        ("hello", "HELLO"),
        ("", ""),                # empty-string edge case
        ("PyThOn", "PYTHON"),
    ],
    ids=["basic", "empty-string", "mixed-case"],
)
def test_uppercase(input_value, expected):
    assert input_value.upper() == expected
```

Always pass `ids` (or name-worthy tuple values) once cases stop being
self-evident from their values alone — `test_uppercase[hello-HELLO]` in
default pytest output is fine, `test_validate[case3]` from an unlabeled
complex object is not; a failing-test report should tell you which case
failed without opening the source file.

Apply the stack-agnostic edge-case categories from
`dev-kickoff-edho-ferdian/references/test-design-checklist.md` when choosing
parametrize cases — parametrize is the pytest mechanism, the checklist is
what decides *which* rows belong in the table (empty input, boundary value,
invalid type, and so on), same relationship this skill's SKILL.md describes
for every stack.

### Parametrized fixtures

```python
@pytest.fixture(params=["sqlite", "postgresql"])
def db_backend(request):
    return make_db(request.param)

def test_query_runs_on_every_backend(db_backend):
    assert db_backend.query("SELECT 1") is not None
```

Use this when the *same test body* needs to run against several
implementations of a shared contract (e.g. a repository interface with two
backends) — this is pytest's answer to a shared-contract test suite, and is
usually a better fit than copy-pasting the test once per backend.

---

## Mocking — `unittest.mock` and `pytest-mock`

### `@patch` and where to patch

```python
from unittest.mock import patch

@patch("mypackage.service.external_api_call")
def test_service_handles_api_success(mock_call):
    mock_call.return_value = {"status": "success"}

    result = run_service()

    mock_call.assert_called_once()
    assert result["status"] == "success"
```

**Patch where the name is looked up, not where it's defined.** If
`mypackage/service.py` does `from mypackage.client import external_api_call`,
patch `mypackage.service.external_api_call` (the name bound in the module
under test), not `mypackage.client.external_api_call` — patching the
original definition doesn't affect the already-imported reference the code
under test actually calls. This is the single most common pytest-mock
mistake and produces a mock that silently never gets called, with the real
function running instead.

### `pytest-mock`'s `mocker` fixture

`pytest-mock` wraps `unittest.mock` in a fixture (`mocker`) that
auto-undoes every patch at test teardown, which removes the risk of a
leaked patch bleeding into the next test — prefer it over bare `@patch`
decorators once a test needs more than one or two patches, since stacking
`@patch` decorators reverses argument order and gets hard to read past two:

```python
def test_service_handles_api_success(mocker):
    mock_call = mocker.patch("mypackage.service.external_api_call")
    mock_call.return_value = {"status": "success"}

    result = run_service()

    mock_call.assert_called_once()
    assert result["status"] == "success"
```

### `side_effect` for exceptions and sequences

```python
def test_retries_on_transient_failure(mocker):
    mock_call = mocker.patch("mypackage.service.external_api_call")
    mock_call.side_effect = [ConnectionError("boom"), {"status": "ok"}]

    result = run_service_with_retry()

    assert result["status"] == "ok"
    assert mock_call.call_count == 2
```

`side_effect` as a list yields each value/exception in order across
successive calls — the direct way to test a retry loop's actual behavior
(fails once, succeeds on the retry) instead of only testing the
happy-path single call.

### `autospec` — catch API misuse the plain mock won't

```python
mocker.patch("mypackage.DBConnection", autospec=True)
```

A plain `Mock` accepts any attribute access or call signature silently,
which means a test can pass against a mock whose interface has drifted from
the real object's (a renamed method, a changed argument count) — `autospec`
makes the mock raise `TypeError` on a call signature the real object doesn't
support, catching that drift at test time instead of in production the day
the real dependency's interface actually gets exercised.

### What to mock

Mock at the boundary the test doesn't own: an external HTTP call, a
third-party SDK, the wall clock, randomness, a real filesystem/network
resource. Don't mock the function under test's own internal collaborators
just to isolate it artificially — that tests the mocking, not the behavior,
and produces the same "test passes, feature is broken" outcome this
ecosystem's regression-testing reference warns about for any stack.

---

## Async test patterns — `pytest-asyncio`

```python
import pytest

@pytest.mark.asyncio
async def test_async_fetch_returns_parsed_response():
    result = await fetch_and_parse("https://example.test/data")
    assert result["status"] == "ok"
```

- Requires `pytest-asyncio` installed and either `@pytest.mark.asyncio` per
  test, or `asyncio_mode = "auto"` in pytest config to apply it to every
  `async def test_*` automatically — check which mode a project uses before
  assuming a plain `async def test_...` will run at all (under strict mode
  without the marker, pytest silently skips it with a warning rather than
  failing loudly, which is an easy way to end up with a test that looks
  present but never actually executes).
- **Async fixtures** need the same `async def` + `yield` shape as sync
  fixtures, and (depending on `pytest-asyncio` version) may need
  `@pytest_asyncio.fixture` explicitly rather than the plain `@pytest.fixture`
  decorator — check the installed version's docs rather than assuming.
  ```python
  import pytest_asyncio

  @pytest_asyncio.fixture
  async def async_client():
      app = create_app()
      async with app.test_client() as client:
          yield client
  ```
- **Mocking an async function** needs `AsyncMock` (or `mocker.patch(...,
  new_callable=mocker.AsyncMock)`), not a plain `Mock` — a plain `Mock`
  substituted for an `async def` produces a `Mock` object instead of a
  coroutine when called, which then fails at `await` with a confusing error
  far from the actual mistake:
  ```python
  @pytest.mark.asyncio
  async def test_async_mock(mocker):
      mock_call = mocker.patch(
          "mypackage.async_api_call", new_callable=mocker.AsyncMock
      )
      mock_call.return_value = {"status": "ok"}

      result = await my_async_function()

      mock_call.assert_awaited_once()
      assert result["status"] == "ok"
  ```
  `assert_awaited_once()` (not `assert_called_once()`) confirms the coroutine
  was actually awaited, not merely constructed and discarded — a bug where
  code calls an async function without `await`ing it produces a real
  `RuntimeWarning: coroutine was never awaited` in production but can pass a
  test that only checks `assert_called_once()`.
- Don't mix `time.sleep()` into an async test to "wait for" something —
  same anti-pattern `react.md` flags for RTL's `setTimeout`; use
  `asyncio.sleep(0)` to yield control if a genuine scheduling point is
  needed, or (preferably) restructure the test to await the actual
  operation directly.

---

## Coverage configuration

```ini
# pytest.ini or pyproject.toml [tool.pytest.ini_options]
addopts = --cov=mypackage --cov-report=term-missing --cov-report=html
```

```bash
pytest --cov=mypackage --cov-report=term-missing
```

`--cov-report=term-missing` prints the specific uncovered line numbers
inline — prefer it over a bare coverage percentage during authoring, since
it tells you exactly which branch still needs a case rather than making you
open the HTML report to find out.

Apply the same 80% floor and its qualifications from
`baseline-testing-standards.md` — coverage percentage is a floor to notice a
gap, not a target to chase with weak assertions; a parametrized test with
ten cases and a single `assert result is not None` per case can hit high
coverage numbers while asserting almost nothing (see this ecosystem's
test-quality-lens TQ-06 for how that divergence gets caught in review).

### Marker-based test selection

```ini
[pytest]
markers =
    slow: marks tests as slow
    integration: marks tests as integration tests
```

```bash
pytest -m "not slow"          # skip slow tests in the fast local loop
pytest -m integration          # run only integration tests
```

Register every custom marker in config (`--strict-markers` catches a typo'd
marker name at collection time instead of it silently doing nothing) —
without `--strict-markers`, `@pytest.mark.sow` (a typo) is accepted silently
and the test just never gets excluded by `-m "not slow"`.

---

## Anti-patterns to avoid

- Patching the definition site instead of the usage site (see "where to
  patch" above) — produces a mock that's silently never invoked.
- A plain `Mock` standing in for an `async def` — produces a coroutine-never-
  awaited bug that a `assert_called_once()`-only test won't catch.
- Session- or module-scoped fixtures holding mutable state read *and*
  written by multiple tests without an explicit reset — the pytest analogue
  of the shared-`QueryClient` flake trap.
- Catching an exception inside the test body to inspect it instead of using
  `pytest.raises(...)` — loses the guarantee that the test fails if the
  exception never happens at all.
- A parametrize table with unlabeled complex-object cases (`ids` omitted) —
  a failure report that doesn't say which case failed without opening the
  source.
- `time.sleep()`/fixed-delay waits standing in for a real async
  synchronization point.
