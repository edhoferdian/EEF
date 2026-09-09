# Language Lens — Android / Kotlin Clean Architecture

DI/coroutine/ProGuard specifics are folded in alongside the core
Clean Architecture layering guidance below.

**Detect.** A `build.gradle`/`build.gradle.kts` at the project root with an
`com.android.application`/`com.android.library` or
`org.jetbrains.kotlin.multiplatform` plugin, or any `.kt`/`.kts` file in
review scope belonging to an Android or Kotlin Multiplatform (KMP) module.
This lens covers **architecture/layering** for Android/KMP; Compose-specific
UI/state findings are `references/compose-multiplatform.md`'s job — the two
combine on a real Compose Android app the same way `python.md` +
`python-django.md` combine.

**Boundary — read before flagging anything.** Generic function-length/
nesting/magic-number checks, generic error-handling discipline, and generic
DI-principle checks already owned by `references/review-checklist.md` are
**not re-flagged here**. This lens adds only what is specific to **Clean
Architecture's layer/dependency rules as they apply to Android/KMP module
graphs**, and Kotlin coroutine-scope discipline where it intersects with that
layering (a `GlobalScope` leak is a layering-adjacent lifetime bug, not a
generic async-correctness nit).

**Code placement.** Findings land as **CQ-11 (Android/KMP architecture &
layering anti-patterns)** in the general report, matching the code the
Go/Java-Spring/Laravel/NestJS lenses already use for their own
architecture-layer findings — an Android module-boundary violation is the
same category of finding as a Go package-boundary violation, not a UI/idiom
one. **No `§Kotlin`/`§Android` section exists yet in `security-review-edho-
ferdian/references/language-specific.md`.** Until one is written, flag
Android/Kotlin security findings directly under Domain 2 (SEC) using the
general skill's existing codes — **SEC-02** (secret exposure: hardcoded API
keys instead of `BuildConfig`/CI secrets), **SEC-10** (token handling:
secrets outside `EncryptedSharedPreferences`/Keychain), **SEC-01** (input
sanitization: string-concatenated Room/SQLDelight queries) — rather than
inventing a new per-stack code here.

---

## Ground-truth commands

```bash
./gradlew build                      # compiles all modules — confirms layering findings that are also compile errors
./gradlew :domain:dependencies       # print the domain module's dependency tree — confirms a domain->data/framework leak
./gradlew lint                       # Android Lint — catches manifest/resource-level findings
./gradlew detekt                     # if configured — static analysis for Kotlin idiom findings
./gradlew test                       # unit tests (JVM, fast)
./gradlew connectedAndroidTest       # instrumented tests, only when device/emulator-dependent behavior is in scope
```

A `domain` module that compiles clean with `./gradlew :domain:dependencies`
showing zero Android/framework/`data`-module entries in its dependency tree
is the ground-truth confirmation for every "domain purity" finding below —
don't assert a domain-layer leak from reading imports alone when this command
can confirm or refute it directly.

---

## Lens criteria

### CRITICAL

- **`domain` module importing an Android framework class** (`android.*`,
  `androidx.*`) **or a `data`/`presentation`-module type.** Clean
  Architecture's entire point is that domain is pure Kotlin with zero
  framework or outer-layer dependency — a single leaked import (a `Context`
  parameter on a UseCase, a Room `@Entity` referenced from a domain model)
  collapses the boundary and makes the domain layer untestable without
  Android, and unswappable to a different data source without touching
  business logic. **CQ-11.**
- **A database entity (`@Entity`) or a raw network DTO exposed directly to
  the presentation/UI layer** instead of mapped to a domain model at the
  repository boundary. Couples UI code to storage/wire-format details that
  can change independently of what the UI actually needs, and usually means
  UI code ends up doing its own ad-hoc field renaming/parsing that the
  mapper should own in one place. **CQ-11.**
- **Circular module dependency** (module A depends on B, B depends on A,
  directly or through a longer cycle) — Gradle can still build this in some
  configurations via `api`/`implementation` tricks, but it defeats the
  entire purpose of modularization (independent compilation, clear ownership,
  enforceable layering) and usually indicates a UseCase or shared type that
  belongs in a lower layer (often `core`) instead of one of the two coupled
  modules. **CQ-11.**
- **`GlobalScope.launch { ... }` used for work tied to a
  ViewModel/Activity/Fragment lifecycle** instead of `viewModelScope` (or a
  properly scoped `CoroutineScope` that's cancelled with the owning
  component). `GlobalScope` work outlives its logical owner — it keeps
  running (and can keep references alive) after the screen that started it
  is gone, and its exceptions don't propagate anywhere structured.
  **CQ-11.**

### HIGH

- **Business logic (validation, branching decisions, multi-step
  orchestration) implemented directly in a ViewModel** instead of extracted
  to a UseCase. A ViewModel's job is translating UseCase results into UI
  state, not deciding what those results should be — logic buried in a
  ViewModel is untestable without instantiating Android's ViewModel
  machinery and unreusable from another entry point (a widget, a background
  worker) that needs the same rule. **CQ-11.**
- **A "fat" repository implementation** handling multiple unrelated data
  concerns (auth tokens, user profile, app settings, feature flags) in one
  class instead of split into focused DataSources/Repositories per concern.
  Same single-responsibility violation the general checklist already flags
  generically (CQ-01) — this is its architecture-layer-specific shape:
  watch for it specifically at the repository-implementation boundary where
  it's easy to keep bolting "just one more" data source onto an existing
  class. **CQ-11.**
- **A UseCase constructed internally by the class that uses it**
  (`class Foo { private val useCase = GetItemsUseCase(ItemRepositoryImpl())
  }`) instead of injected via constructor/DI framework — makes the class
  impossible to test without hitting the real repository implementation, and
  hides the dependency graph from whatever's supposed to own composition
  (Koin/Hilt module, or a manual composition root). **CQ-11.**
- **Result/error type inconsistency across the domain boundary** — some
  UseCases return `Result<T>`, others throw, others return a nullable with no
  distinction between "not found" and "failed" — forces every call site to
  guess which error-handling shape applies instead of one consistent
  contract (a `Result<T>` or a sealed `Try`/`AppError` type used
  everywhere). **CQ-11.**
- **A mapper (entity↔domain, DTO↔domain) duplicated in multiple places**
  instead of one canonical extension function near the data model it maps —
  drifts when one copy is updated and the other isn't, silently producing
  two different domain-model shapes from the same source data depending on
  which mapper ran.

### MEDIUM

- **Environment-specific behavior (dev/staging/prod) branched with a runtime
  `if (BuildConfig.DEBUG)`/flavor check scattered through business logic**
  instead of injected via configuration (separate DI module per build
  variant/flavor, or a config object provided at composition time). Scatters
  environment awareness through code that shouldn't need to know which
  environment it's running in.
- **Service-locator-style DI calls** (`GetIt.instance<X>()`/Koin's
  `get()`-from-anywhere) used scattered through business logic instead of
  constructor injection — hides a class's real dependencies from its
  signature, making them discoverable only by reading the implementation.
- **A `feature/` module reaching into another feature module's internal
  package** instead of going through a shared `domain`/`core` contract —
  breaks the modularization boundary the folder structure was meant to
  enforce, even when it isn't a full dependency cycle.
- **Missing `Upsert`/proper conflict strategy on a Room DAO insert** that's
  meant to update-or-insert, using a plain `@Insert` with `OnConflictStrategy.
  IGNORE`/`REPLACE` chosen without checking the actual intended semantics —
  a data-correctness risk more than a pure architecture one, but shows up at
  the same repository/DataSource layer this lens already reviews.

---

## False-positive traps

- `ref.watch`-equivalent dependency chains (a UseCase depending on another
  UseCase's output via the ViewModel, not directly) are not a circular
  dependency — only flag genuine module-graph cycles confirmed by
  `./gradlew :module:dependencies`, not "these two UseCases are used
  together" or "this feature calls that feature's public API".
- A domain model that happens to share a name with a data-layer entity
  (`Item` in both `domain` and `data.local`) is not itself a finding — the
  finding is the *presentation layer* importing the data-layer `Item`
  instead of the domain one; two distinctly-scoped types with the same name
  in different layers is exactly what the mapper pattern expects.
- `single<X> { ... }` (Koin) or `@Singleton` (Hilt) is not itself a
  service-locator anti-pattern — DI framework registration is expected;
  the finding is code calling `get<X>()`/`getIt<X>()` ad hoc *outside* the
  composition root, not the registration itself.
- A small, genuinely single-purpose repository with only 2-3 related
  methods is not a "fat repository" just because it has more than one
  method — the finding is about unrelated concerns bundled together, not
  method count.

## Escalate to general domain when…

- The finding is about **Compose UI/state/recomposition** specifically
  (a ViewModel exposing `mutableStateOf` instead of `StateFlow`, a missing
  `key()` in a `LazyColumn`) — that's `references/compose-multiplatform.md`'s
  job, not this lens's.
- The finding is a **Gradle/AGP/dependency-resolution build failure** rather
  than a review-time architecture concern — that's `build-fix-edho-ferdian/
  references/android.md`'s job.
- A performance claim needs **actual profiling** (Android Studio Profiler,
  a baseline-profile measurement) to confirm rather than static reading —
  escalate to `performance-audit-edho-ferdian`.
- The finding is a **generic Kotlin idiom** issue with no architecture-layer
  or coroutine-lifecycle angle (e.g. `var` where `val` would do, a missing
  data-class `copy()` usage) — general Domain 1 (CQ), not this lens; this
  lens is scoped to Clean Architecture layering specifically, not general
  Kotlin style.
