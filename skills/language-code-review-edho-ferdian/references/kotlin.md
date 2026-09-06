# Language Lens — Kotlin

Adapted from ECC `kotlin-patterns`, `kotlin-testing`, `kotlin-coroutines-flows`,
`kotlin-exposed-patterns`, and `kotlin-ktor-patterns`, fetched 2026-09-07.

**FOLD-M.** Kelompok DEFER-backlog: konten padat, plausibel dari sumber ECC,
tapi **belum ada bukti proyek Kotlin/Android/KMP/Ktor aktif** di workspace
Edho saat ini — beda dari lens Python/React (FOLD-P) yang sudah dipakai pada
proyek nyata di ekosistem ini. File ini ditulis proaktif (gate "tunggu
proyek nyata" dicabut per keputusan pemilik ekosistem), tapi perlakukan
sebagai lens siap-pakai begitu proyek Android/KMP/Ktor muncul, bukan sebagai
sesuatu yang sudah tervalidasi lapangan.

**Detect.** A `build.gradle.kts`/`build.gradle` with a `kotlin(...)` plugin
block, any `.kt`/`.kts` file in review scope, or an Android project with
`AndroidManifest.xml` + Kotlin sources.

**Boundary — read before flagging anything.** Generic injection, generic
secret handling, generic function-length/nesting/magic-number checks, and
generic N+1 detection are **already owned by `references/review-checklist.md`**
in the general skill. This lens adds only what is specific to **Kotlin's
null-safety type system, sealed/data-class modeling, structured-concurrency
(coroutines/Flow) discipline, Exposed ORM query correctness, and Ktor server
conventions**.

**Code placement.** Findings land as **CQ-14 (Kotlin idiom / coroutine /
ORM / Ktor anti-patterns)** in the general report. **Security is out of
scope for this lens and not yet ported anywhere in this ecosystem** — ECC's
`rules/kotlin/security.md` (secrets management, network security, WebView/
JavaScript-interface hardening, ProGuard/R8 keep-rules) has no counterpart
in `security-review-edho-ferdian/references/language-specific.md` today,
unlike the Java/Spring precedent (D-012) where security was already ported
separately. If a Kotlin security lens is ever built, it belongs there, not
here — don't silently absorb security findings into CQ-14 just because
this file is the only Kotlin lens that currently exists.

**Placement decision — `kotlin-exposed-patterns` (read before reviewing DB
code).** `data-layer-patterns-edho-ferdian/SKILL.md` already sets the
precedent for JPA: "should land as a sub-section of
`data-layer-patterns-edho-ferdian` when activated, not a standalone
reference file — it's ORM/query depth, the same category that file already
owns for other stacks." The same logic applies to Exposed. This file
carries the Exposed content below **only because the integrating session
asked this agent not to touch `data-layer-patterns-edho-ferdian/SKILL.md`
directly** (other agents are editing that file's own "Stacks planned"
prose in parallel). **Recommended follow-up for the central integrator:**
move the "Exposed ORM (from `kotlin-exposed-patterns`)" section below into
`data-layer-patterns-edho-ferdian/references/` as its own sub-section (same
shape as the JPA precedent), leaving only a one-line pointer here — exactly
as `python-fastapi.md`/`python-django.md` point back at `python.md`. Until
that move happens, the content stays here so it isn't lost.

---

## Ground-truth commands

```bash
./gradlew build                 # full compile, all source sets
./gradlew compileKotlin         # compile main source set only (fastest feedback)
./gradlew detekt                # static analysis — most idiom findings below are detekt-detectable
./gradlew ktlintCheck           # formatting check
./gradlew test                  # Kotest/JUnit run
./gradlew koverHtmlReport        # coverage report
./gradlew koverVerify           # enforce coverage threshold (fails build below configured %)
./gradlew dependencies          # dependency tree — version conflict diagnosis
```

Do not label a detekt-detectable finding (e.g. `TooGenericExceptionCaught`,
`SwallowedException`, `MagicNumber`) as [High confidence] without having
actually run `./gradlew detekt` — recognizing the pattern by eye is
reasoning, not verification, per the general skill's Phase 2 rule.

---

## Lens criteria

### CRITICAL

- **`!!` (not-null assertion) on a value that can plausibly be null at
  runtime** — throws `NullPointerException` with no context beyond "value
  was null"; defeats the entire purpose of Kotlin's nullable type system.
  Acceptable only where nullability is *provably* impossible at that point
  (state the proof in a comment) or in test code. **CQ-14.**
- **`GlobalScope.launch { }` / `GlobalScope.async { }`** — an unscoped
  coroutine outlives its logical owner, can't be cancelled when the
  caller's lifecycle ends (Activity/ViewModel destroyed, request finishes),
  and leaks. Always launch from a structured scope (`viewModelScope`,
  `coroutineScope { }`, an injected `CoroutineScope` tied to a lifecycle).
  **CQ-14.**
- **Catching `CancellationException`** (bare `catch (e: Exception)` around
  a suspend call, without re-throwing `CancellationException`) — swallows
  the coroutine cancellation signal, so the coroutine keeps running after
  its scope was cancelled, defeating structured concurrency entirely. Every
  broad catch around suspending code must re-throw `CancellationException`
  first. **CQ-14.**
- **Raw SQL string concatenation with user input inside an Exposed query**
  (`"WHERE name = '$input'"` in a `.where { }` block via `exec()` /
  raw SQL, bypassing the DSL's parameterization) — SQL injection. Exposed's
  DSL (`eq`, `like`, etc.) parameterizes automatically; only hand-rolled
  raw SQL strings reintroduce the risk. **CQ-14.**

### HIGH

- **`.let`/`.also`/`.apply`/`.run` nested three or more levels deep**
  (`user?.let { u -> u.address?.let { a -> a.city?.let { c -> ... } } }`) —
  unreadable and usually replaceable with a direct null-safe chain
  (`user?.address?.city?.let { ... }`). **CQ-14.**
- **Blocking call inside a `suspend fun` or coroutine builder** —
  `Thread.sleep()`, synchronous JDBC/file I/O, or a CPU-bound loop with no
  suspension point, run without `withContext(Dispatchers.IO)` /
  `Dispatchers.Default`, blocks the underlying thread and starves the
  dispatcher's thread pool of other coroutines. **CQ-14.**
- **Wildcard `else ->` arm on an exhaustive `when` over a `sealed class`/
  `sealed interface`** — throws away the compiler's guarantee that adding a
  new subtype forces every call site to handle it. A catch-all on a
  non-sealed/external enum is fine; on an internal sealed hierarchy
  modeling your own domain states, it hides a future bug. **CQ-14.**
- **`newSuspendedTransaction` block missing around an Exposed DSL/DAO
  call**, or a suspend function performing Exposed queries directly on the
  calling coroutine's dispatcher — Exposed transactions are not
  automatically coroutine-safe; every DB operation from suspend code needs
  `newSuspendedTransaction { }` (or `newSuspendedTransaction(db = ...)`     when a
  non-default `Database` instance is in play). **CQ-14.**
- **Mutable collection or mutable data class exposed as public API**
  (`var` properties on a `data class` shared across coroutines/threads, or
  a function returning `MutableList<T>`/`MutableStateFlow<T>` instead of
  the read-only view) — invites unsynchronized mutation from callers.
  Return `List<T>`/`StateFlow<T>` and mutate only behind a private
  `MutableStateFlow`/`MutableList` with `.update { it.copy(...) }`.
  **CQ-14.**
- **Ktor route handler performing business logic directly** (DB queries,
  validation, external API calls inline inside a `get { }`/`post { }`
  block) instead of delegating to a service/use-case — makes the route
  untestable without spinning up `testApplication` and mixes HTTP concerns
  with domain logic. **CQ-14.**

### MEDIUM

- **`.copy()` chains that reconstruct most fields on every call** instead
  of a lens-style helper or restructuring the data class — a correctness-
  neutral readability smell worth flagging when it recurs across a file.
  **CQ-14.**
- **Manual accumulation loop where a collection chain
  (`.filter().map().associate()`) is clearer** — flag only when the chain
  form is genuinely more readable, not as a blanket style preference.
  **CQ-14.**
- **Primitive obsession** — a bare `String`/`UUID` used for a domain
  concept (`userId: String`) that would benefit from a `@JvmInline value
  class` (`UserId(val value: String)`) to prevent argument-order mix-ups at
  call sites with multiple same-typed parameters, at zero runtime cost.
  **CQ-14.**
- **`stateIn(..., SharingStarted.Eagerly, ...)` (or no
  `WhileSubscribed`) for UI-facing `StateFlow`** — keeps the upstream Flow
  active even with zero subscribers (e.g. after a config change or screen
  navigation away), wasting resources; `SharingStarted.WhileSubscribed
  (5_000)` is the idiomatic default for UI state. **CQ-14.**
- **`.find { }.firstOrNull()` or `.filter { }.size` where a directly
  matching Exposed DSL exists** (`.where { }.limit(1)`, `.count()`) —
  pulls more rows than necessary across the JDBC boundary before filtering
  in Kotlin instead of letting the database do it. **CQ-14.**
- **Missing pagination on an Exposed query returning a user-facing list**
  (`selectAll()` with no `.limit()`/`.offset()`) on a table that can grow
  unbounded — same N+1-adjacent risk the general skill's checklist already
  flags for other ORMs, called out here because Exposed's DSL makes it easy
  to forget `.limit()` since nothing enforces it. **CQ-14.**
- **Ktor `install(ContentNegotiation)` / `install(CORS)` configured with
  overly permissive defaults left over from a tutorial** (`anyHost()` in
  production CORS config, `ignoreUnknownKeys = true` masking a real client/
  server contract mismatch) — flag when the surrounding code suggests this
  is meant to be production config rather than local dev. **CQ-14.**
- **`@Serializable` data class exposing internal property names directly
  as the wire format** with no explicit `@SerialName` where the internal
  and external naming conventions clearly diverge — couples the public API
  contract to internal refactors. **CQ-14.**

---

## Testing lens (from `kotlin-testing`)

- **Kotest spec style mixed within the same module** (some files
  `StringSpec`, others `FunSpec`/`BehaviorSpec` with no consistent
  rationale) — pick one style per module/feature area; mixing forces
  reviewers to context-switch test idioms for no benefit.
- **`mockk<T>()` used to mock a `data class`** — mock behavior, not plain
  data holders; construct a real instance instead. The general skill's
  test-quality lens already owns "mock everything" as an anti-pattern —
  this is the Kotlin-specific instance of it (MockK makes mocking a data
  class trivially easy, which is exactly why it gets reached for
  unnecessarily).
- **`Thread.sleep()` inside a coroutine test** instead of
  `advanceTimeBy`/`advanceUntilIdle` on a `TestDispatcher` under `runTest`
  — makes the test slow and still non-deterministic relative to virtual
  time; the whole point of `runTest` is to control time without real
  delays.
- **Missing `coVerify`/`coEvery` on a suspend function**, using the
  non-coroutine `every`/`verify` MockK variants on a `suspend fun` — this
  compiles in some MockK setups but doesn't correctly stub/verify
  suspension; always match `co*` MockK APIs to suspend functions.
- **Property-based tests (Kotest `checkAll`/`forAll`) missing for
  parsers/serializers** — round-trip properties
  (`decode(encode(x)) == x`) catch classes of bugs example-based tests
  miss; flag their absence only for code with an obvious round-trip or
  invariant property, not universally.
- **Exposed repository tests without an in-memory H2 database** (mocking
  the `Database`/`Transaction` object instead of running real queries
  against H2 in `PostgreSQL` compatibility mode) — an Exposed repository's
  entire value is its query correctness; mocking it away tests nothing
  about the actual SQL generated.
- **Coverage via `./gradlew koverVerify`**, same targets as the general
  skill's Domain 5 (100% critical logic, 90%+ public API, 80%+ general,
  generated/serialization-boilerplate code excluded).

---

## Coroutines & Flow lens (from `kotlin-coroutines-flows`)

- **Collecting a `Flow` inside `init { }`** (a class constructor block)
  without a scope to launch from — there's no coroutine to collect on at
  that point; collection needs `viewModelScope.launch { flow.collect {
  } }` or equivalent, never a bare `collect` call in a non-suspending
  context.
- **`flowOn(Dispatchers.Main)` placed to influence collection** — `flowOn`
  changes the dispatcher for everything *upstream* of it, not the
  collector; the collection itself always runs on the calling coroutine's
  dispatcher. A `flowOn(Dispatchers.Main)` right before `.collect` is very
  likely a misunderstanding of what it does.
- **`Flow` built inside a `@Composable` without `remember`** — recreates
  the flow (and restarts its upstream work) on every recomposition instead
  of once per composition lifecycle.
- **`combine`/`zip` over more than a handful of flows with no name for
  the resulting tuple** — the positional lambda destructuring
  (`{ a, b, c, d, e -> }`) becomes error-prone past 3–4 flows; consider a
  data class or `combine` overload with named extraction.
- **Retry logic without a cap or backoff** (`retry { true }` or
  unconditional infinite retry) on a Flow wrapping a network call — can
  hammer a failing backend indefinitely; use `retryWhen` with an attempt
  count and exponential backoff.

---

## Exposed ORM lens (from `kotlin-exposed-patterns`)

**See the placement decision above** — this section is a stand-in for what
should eventually be a `data-layer-patterns-edho-ferdian` sub-section.

- **DAO entity's `referrersOn`/`referencedOn` relationship accessed inside
  a loop without eager batching** — each access inside a `forEach` issues
  its own query (Exposed's DAO equivalent of the classic ORM N+1); prefer a
  single join query via the DSL when iterating a collection and reading a
  related entity for each item.
- **`resultedValues!!.first()`** used to read back an insert's generated
  values — the `!!` here is idiomatic in the ECC source examples but still
  a real crash risk if the insert silently returns no rows (a trigger
  intercepting the insert, a `RETURNING`-incompatible driver); prefer
  `resultedValues?.firstOrNull() ?: error("insert did not return a row")`
  with an explicit message over a bare `!!`.
- **LIKE-pattern search built by naive string concatenation** — the ECC
  source's own `escapeLikePattern` helper (`replace("\\", "\\\\").replace
  ("%", "\\%").replace("_", "\\_")`) exists specifically to prevent
  wildcard injection when user input flows into a `like` clause; flag any
  `like "%$rawUserInput%"` that skips this escaping step.
- **Transaction isolation left at the default for an operation with a
  documented race condition** (balance transfers, inventory decrements) —
  `newSuspendedTransaction(transactionIsolation = Connection
  .TRANSACTION_SERIALIZABLE)` or explicit row locking is needed for
  genuinely concurrent read-modify-write sequences; the default isolation
  level is a correctness bug for these specific operations, not a
  performance nitpick.
- **Custom column type (`jsonb<T>` helper) missing null/malformed-value
  handling** on `valueFromDB` — a `PGobject` with a null inner value or an
  unexpected DB type reaching a custom `ColumnType` should fail with a
  clear `IllegalArgumentException` naming the column, not an obscure
  `ClassCastException` further down the stack (the ECC source example
  already does this correctly — flag any custom column type that doesn't).

---

## Ktor server lens (from `kotlin-ktor-patterns`)

- **`StatusPages` missing a catch-all `exception<Throwable>` handler** —
  without one, an unhandled exception in a route returns Ktor's default
  error page (potentially leaking a stack trace) instead of a controlled
  JSON error envelope.
- **JWT `validate { }` block that doesn't check audience/issuer**, only
  verifying the signature — accepts any token signed with the right
  secret regardless of what it was issued for, widening the token's usable
  scope beyond intent.
- **WebSocket connection set (`Collections.synchronizedSet` or similar)
  iterated for broadcast without a synchronized snapshot** — iterating a
  synchronized collection directly while another coroutine mutates it
  still risks `ConcurrentModificationException`; snapshot to an immutable
  list under the lock first (the ECC source's own `chatRoutes` example
  does this correctly — flag any broadcast loop that doesn't).
- **Route-level `require()` used for request validation** instead of a
  `StatusPages`-mapped exception or a dedicated validation result type —
  `require()` throws `IllegalArgumentException`, which only produces a
  clean 400 response if `StatusPages` maps that exception type; without
  that mapping it surfaces as an unhandled 500.
- **CORS configured with `anyHost()` alongside `allowCredentials = true`**
  — this combination is rejected by browsers per the CORS spec (credentialed
  requests can't use a wildcard origin) and is also a real security
  loosening if it were somehow honored; flag it as a functional bug, not
  just a hardening suggestion.

---

## False-positive traps

- `!!` inside a `@Test` function, in `main()` for a fail-fast startup
  check, or immediately after an explicit `check`/`require` that already
  proved non-nullity in the preceding line is the acceptable case — don't
  flag it reflexively just because it's `!!`.
- A wildcard `else ->` arm on a `when` over a genuinely external/platform
  enum (from a library you don't control, which can add values without
  warning) is often the *correct* defensive choice — the finding is about
  internal `sealed class`/`sealed interface` hierarchies only.
- `GlobalScope` inside a `main()` top-level CLI tool with no lifecycle to
  scope to, and no cancellation ever needed for the process's lifetime, is
  a narrow acceptable case — verify there is genuinely no enclosing scope
  available before flagging as CRITICAL.
- `.let`/`.also` nesting two levels deep is normal Kotlin; the HIGH finding
  above is specifically about three-or-more nesting that actually hurts
  readability, not any use of nested scope functions at all.

## Escalate to general domain when…

- The finding is generic injection/secret-handling with no Kotlin-specific
  nuance — that's the general skill's SEC domain (and currently has no
  Kotlin-specific counterpart at all, per the Code placement note above).
- The finding is about test coverage percentage rather than Kotlin-specific
  test mechanics — Domain 5 (`test-quality-lens.md`).
- A performance claim about coroutine dispatcher contention or DB query
  latency needs profiling/benchmark evidence to confirm — escalate to
  `performance-audit-edho-ferdian` rather than asserting from code reading
  alone.

---

## Provenance

Adapted from ECC agents/skills `kotlin-patterns`, `kotlin-testing`,
`kotlin-coroutines-flows`, `kotlin-exposed-patterns`, and
`kotlin-ktor-patterns` (github.com/affaan-m/ECC, paths
`skills/kotlin-patterns/SKILL.md`, `skills/kotlin-testing/SKILL.md`,
`skills/kotlin-coroutines-flows/SKILL.md`,
`skills/kotlin-exposed-patterns/SKILL.md`,
`skills/kotlin-ktor-patterns/SKILL.md`, plus supporting rule file
`rules/kotlin/patterns.md`), fetched 2026-09-07.
