# Language Lens — Python / FastAPI

Adapted from ECC `fastapi-reviewer`, fetched 2026-09-04.

**Requires: `python.md` (load first).** This file assumes general Python
idiom checks (mutable defaults, bare except, unsafe deserialization, type
hints) already ran. It adds only FastAPI-framework-specific criteria on top.

**Detect.** A FastAPI import (`from fastapi import FastAPI` / `import
fastapi`) found in `main.py`, `app/main.py`, or another file in the review
scope.

**Boundary — read before flagging anything.** Generic Python style, generic
injection, and generic secret handling stay owned by `python.md` and the
general skill's checklist. This lens adds only what is specific to
**FastAPI's async execution model, dependency-injection system, and Pydantic
schema boundary**.

**Code placement.** Findings land as **CQ-10 (FastAPI-specific
anti-patterns)** or **PERF-08 (FastAPI-specific performance)** in the general
report. **FastAPI-specific security items (SEC-08) have moved to
`security-review-edho-ferdian/references/language-specific.md` §Python /
FastAPI** — this file no longer holds its own copy; see that file for JWT
validation on auth dependencies, secret fields in response models, and the
`allow_origins=["*"]` + `allow_credentials=True` CORS misconfiguration. Load
that file (or delegate to the skill directly) when reviewing security.

---

## Ground-truth commands

```bash
pytest                                        # confirm dependency-override and route behavior
ruff check .
mypy . --ignore-missing-imports
grep -rn "def .*:\s*$" --include=*.py . | grep -v "async def"   # candidate sync route handlers, manual triage
uv run pytest                                 # if the project uses uv instead of pytest directly
```

For blocking-call findings specifically, don't rely on a hunch — trace the
call: confirm the client used inside the `async def` route is genuinely
synchronous (e.g. `requests.get`, a non-async DB driver call, `time.sleep`)
rather than an async-native client (`httpx.AsyncClient`, an `async` ORM
session) before flagging. If you can't trace it to a concrete blocking call,
cap at [Medium confidence].

---

## Lens criteria

### CRITICAL

- **Blocking I/O inside an `async def` route** — a synchronous DB driver
  call, `requests.get(...)`, `time.sleep(...)`, or any other blocking call
  made directly inside an `async def` handler blocks the single event loop
  for every other concurrent request being served by that worker, not just
  the current one. Fix: use an async-native client, or run the blocking call
  in a thread pool (`run_in_threadpool`/`asyncio.to_thread`). **PERF-08.**
- **Database session created inline inside a handler** instead of injected
  via `Depends(get_db)` (or equivalent) — bypasses the app's session
  lifecycle (commit/rollback/close guarantees), and usually means the
  connection isn't cleaned up on an exception path. **CQ-10.**
**FastAPI-specific security CRITICALs** (unvalidated JWT expiry/signature on
auth dependencies, secret fields in response models, the
`allow_origins=["*"]` + `allow_credentials=True` CORS combination) moved to
`security-review-edho-ferdian/references/language-specific.md` §Python /
FastAPI — not duplicated here.

### HIGH

- **Dependency-override in tests targeting the wrong dependency** — e.g.
  `app.dependency_overrides[get_db] = override_get_db` when the route
  actually depends on a differently-named or wrapped dependency, so the test
  silently exercises the real dependency (real DB, real auth) instead of the
  intended fake. Verify the override key matches the exact callable used in
  the route's `Depends(...)`. **CQ-10.**
- **Missing timeout on an external HTTP client** — an `httpx.AsyncClient()`
  or similar constructed without a `timeout=` — a hung upstream call then
  hangs the request indefinitely (and, combined with the blocking-I/O
  finding above, can starve the whole worker). **PERF-08.**
- **Write endpoint missing request validation** — a route accepting a raw
  `dict`/`Request` body instead of a typed Pydantic model for `POST`/`PUT`/
  `PATCH` — loses automatic validation, and OpenAPI docs generated from it
  are useless for that endpoint. **CQ-10.**
- **Missing pagination on a list endpoint** — an endpoint returning
  `db.query(Model).all()` (or the async equivalent) with no `limit`/`offset`
  or cursor parameters — can return unbounded rows as the table grows.
  **PERF-08.**
- **Authorization folded into the authentication dependency, so both
  failure modes return 401** — a single `Depends(get_current_user)`-style
  dependency that checks *both* "is this a valid, authenticated user"
  (authentication) *and* "can this specific user perform this specific
  action" (authorization — e.g. "is this user the owner of this resource" or
  "does this user have the `admin` role"), raising the same 401 for both. A
  request from a perfectly valid, authenticated user who simply isn't
  allowed to do this one thing should get **403 Forbidden**, not 401
  Unauthorized — collapsing them is a spec violation (RFC 7235 semantics:
  401 means "who are you," 403 means "I know who you are and the answer is
  no") that also makes it impossible for a client to distinguish "log in
  again" from "you don't have permission" programmatically. Fix: keep
  authentication as its own dependency (401 on failure) and layer
  authorization as a separate dependency/check on top (403 on failure).
  **CQ-10, HIGH.** *(Adapted from ECC `fastapi-patterns`, fetched
  2026-09-04.)*
- **Paginated endpoint missing a deterministic `.order_by()`** — distinct
  from the missing-pagination item above: an endpoint *does* have
  `limit`/`offset`, but the underlying query has no explicit, unique
  `order_by()` clause. Without one, the database is free to return rows in
  whatever order is convenient (often insertion order, but not guaranteed),
  and under concurrent writes between page requests, rows can be **skipped
  or repeated across pages** — a row inserted between two page fetches can
  shift the implicit ordering enough that a row already seen reappears, or a
  row that should appear on page 2 never does. Fix: an explicit `order_by()`
  on a column (or tuple of columns) unique enough to make the ordering
  total, not just "recently used" columns like `created_at` alone if
  duplicates are possible (add the primary key as a tiebreaker). **PERF-08,
  HIGH.** *(Adapted from ECC `fastapi-patterns`, fetched 2026-09-04.)*

### MEDIUM

- **OpenAPI metadata missing response/error models** — a route with no
  `response_model` set, or no documented non-200 responses
  (`responses={404: {...}}`), leaves the generated docs unable to tell
  consumers what a client should expect on failure paths.
- **Route logic duplicated across handlers instead of pulled into a shared
  service/dependency** — the same DB query or business rule copy-pasted into
  multiple route functions instead of extracted once and injected.
- **Settings/config read directly from `os.environ` inside a route or
  service function** instead of via a `pydantic-settings`/`BaseSettings`
  object injected once at startup — makes required config invisible until
  runtime and untestable via dependency override.
- **Bare `Depends()` calls scattered through signatures instead of an
  `Annotated` type-alias convention** — `def route(db: Session =
  Depends(get_db))` repeated across many route signatures instead of
  defining once, e.g. `DbDep = Annotated[Session, Depends(get_db)]` (or
  `AsyncSession` for the async case), then `def route(db: DbDep)`. This is a
  consistency finding, not a correctness bug — flag it when a codebase mixes
  both styles or has enough repetition of the same raw `Depends(...)` call
  that a shared alias would remove real duplication; don't flag a single
  bare `Depends()` in an otherwise small route file. *(Adapted from ECC
  `fastapi-patterns`, fetched 2026-09-04.)*
- **`@app.on_event("startup"/"shutdown")` instead of a `lifespan` context
  manager** — `on_event` is deprecated in current FastAPI/Starlette; the
  required pattern is an `@asynccontextmanager` function passed as
  `FastAPI(lifespan=...)`, which also composes correctly when multiple
  startup/shutdown concerns need to share state (e.g. a DB pool created on
  startup and closed on shutdown) in a way `on_event` handlers, being
  separate functions, cannot. *(Adapted from ECC `fastapi-patterns`, fetched
  2026-09-04.)*

---

## False-positive traps

- A route that is `async def` but contains **no actual blocking call** (pure
  CPU-light logic, or calls only to already-async dependencies) is not a
  finding just because it doesn't `await` anything visible — some routes
  legitimately have no I/O.
- A dependency created with `Depends(get_db)` that itself uses a
  connection-pooled synchronous driver (e.g. classic SQLAlchemy without the
  async extension) is an architectural choice, not automatically a CRITICAL
  blocking-I/O bug — if the project runs the sync driver via
  `run_in_threadpool` internally (check the dependency's own implementation)
  the blocking is already isolated correctly.
- The CORS false-positive trap (`allow_origins=["*"]` without
  `allow_credentials=True`) moved to `security-review-edho-ferdian/
  references/language-specific.md` §Python / FastAPI — not duplicated here.
- Missing `response_model` on an internal/admin-only route that's explicitly
  excluded from public docs (`include_in_schema=False`) is not a finding —
  the OpenAPI-completeness criterion doesn't apply to routes deliberately
  hidden from the schema.

## Escalate to general domain when…

- The finding is about general Python idiom (mutable default, bare except,
  type hints) with no FastAPI-specific mechanism — that's `python.md`, not
  this file.
- A performance claim about the blocking-I/O finding needs actual load-test
  or profiler evidence to size the real-world impact — escalate to
  `performance-audit-edho-ferdian` per the general skill's PERF escalation
  rule; this lens only establishes that the pattern exists.
- The finding is about database query correctness/indexing rather than
  FastAPI's own DI/async model — that's `database-lens.md` in the general
  skill (if the scope also touches SQL/migrations/ORM schema), not this file.
