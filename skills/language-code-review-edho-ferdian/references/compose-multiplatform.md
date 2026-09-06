# Language Lens — Compose Multiplatform / Jetpack Compose

Adapted from ECC `compose-multiplatform-patterns`, fetched 2026-09-07.

**Detect.** A `build.gradle.kts` dependency on `androidx.compose.*`,
`org.jetbrains.compose`, or `compose.multiplatform` (KMP flavor); or any
`.kt` file in review scope containing `@Composable` functions.

**Requires: `references/android.md` (load first when the project is also an
Android/KMP Clean Architecture project).** Module-layering findings — a
ViewModel doing UseCase's job, a domain-layer leak — are that file's job, not
this one's. This lens is scoped narrowly to **Compose's own recomposition
model, state-collection APIs, and navigation/theming conventions** — the
class of bug where the code compiles, looks reasonable, and is still wrong
because of how Compose's snapshot-state and recomposition system actually
works.

**Boundary — read before flagging anything.** Generic function-length/
nesting/magic-number checks and generic DI-principle checks are **already
owned by `references/review-checklist.md`**. Kotlin coroutine-scope
lifecycle findings (`GlobalScope` misuse) and Clean Architecture layering are
`references/android.md`'s job — don't duplicate them here just because a
`@Composable` function happens to call a ViewModel.

**Code placement.** Findings land as **CQ-11 (Compose recomposition &
state-collection anti-patterns)**, sharing `android.md`'s CQ-11 slot since a
real Compose Android project reviews both files together and a single
per-review domain bucket for "mobile architecture + UI-framework mechanics"
is more useful to the report reader than a fourth arbitrary code. No
security-specific content is expected in this lens — Compose UI code rarely
introduces its own security surface distinct from what `android.md` and the
general checklist already cover; if a genuine one surfaces (e.g. a
`WebView`-hosting composable), route it to Domain 2 (SEC) using the general
codes the way `android.md` already does, not a new code here.

---

## Ground-truth commands

```bash
./gradlew build                          # compiles — confirms most findings below are real, not misreadings
./gradlew lintDebug                      # Compose lint checks (unstable-parameter warnings, etc. when the Compose lint checks are enabled)
./gradlew testDebugUnitTest              # ViewModel/state unit tests
./gradlew connectedDebugAndroidTest      # Compose UI tests (androidx.compose.ui.test), when device/emulator-dependent
```

Recomposition-count findings specifically are **not** reliably confirmed by
any command above — they need the Layout Inspector's recomposition counts or
`Modifier.Companion` debug tooling at runtime. A recomposition finding based
on reading the code (e.g. a non-`@Stable` class passed as a parameter) is a
valid [Medium confidence] flag per the general skill's Phase 2 rule; cap it
at [High confidence] only if actually measured.

---

## Lens criteria

### HIGH

- **`mutableStateOf` used inside a ViewModel to expose UI state** instead of
  `MutableStateFlow`/`StateFlow` collected via `collectAsStateWithLifecycle()`.
  `mutableStateOf` is Compose's own snapshot-state primitive, tied to
  Compose's recomposition scope — using it as a ViewModel's exposed state API
  couples the ViewModel to Compose (defeating testability/platform-
  independence) and, more concretely, doesn't respect Android lifecycle the
  way `collectAsStateWithLifecycle()` does, so it can keep collecting/
  recomposing while the screen is stopped. **CQ-11.**
- **`LazyColumn`/`LazyRow` `items(...)` block with no `key = { it.id }`** on
  a list that can reorder, filter, or have items inserted/removed — without
  a stable key, Compose can't correctly preserve per-item state/animations
  across a list change, the same class of bug as a `key={index}` finding in
  React or `:key="index"` in Vue, just Compose's own list API. **CQ-11.**
- **A data class passed as a composable parameter with a non-stable field**
  (a plain mutable `var`, a raw `List`/`MutableList` instead of an immutable
  collection type) and no `@Stable`/`@Immutable` annotation — the compiler
  can't prove the type is stable, so Compose treats every instance as
  "might have changed," making the composable unskippable even when nothing
  actually changed. Verify the type's fields are genuinely immutable before
  adding the annotation — annotating a type that actually does mutate is
  worse than not annotating it, since it tells Compose to trust a promise
  the code doesn't keep. **CQ-11.**
- **`LaunchedEffect(Unit)` used as a substitute for ViewModel
  initialization logic** — depending on the navigation/configuration-change
  setup, an effect keyed on `Unit` can re-run on recomposition triggers that
  aren't a genuine "first entry to this screen" event (e.g. some navigation
  back-stack restore paths), producing a duplicate side effect (a duplicate
  network call, a duplicate analytics event) that a ViewModel's `init`
  block wouldn't have. **CQ-11.**

### MEDIUM

- **Heavy synchronous computation performed directly inside a `@Composable`
  function body** (parsing, filtering a large list, formatting) instead of
  in the ViewModel or wrapped in `remember(key) { ... }` — recomputed on
  every recomposition instead of only when its inputs actually change.
- **New lambda or list literal allocated inline as a composable parameter on
  every recomposition** (`onClick = { handle(item) }` created fresh inside a
  loop, `items.filter { it.isActive }` called directly in the composable
  body) instead of hoisted with `remember`/`remember(items)` — defeats
  Compose's ability to skip recomposition for that parameter, the direct
  analogue of the "new object literal passed as a memoized-child prop"
  finding in the React lens.
- **`NavController` passed several composable layers deep** instead of
  exposing lambda callbacks (`onNavigateToDetail: (String) -> Unit`) from
  each screen and wiring the actual `navController.navigate(...)` call only
  at the `NavHost`/top level — couples every intermediate composable to
  navigation, and makes those composables harder to preview/test in
  isolation since they now need a real or fake `NavController`.
- **`derivedStateOf` missing where a value is derived from frequently-
  changing state but read by an infrequently-recomposing consumer** — e.g.
  reading `listState.firstVisibleItemIndex` directly to decide whether to
  show a "scroll to top" button causes every scroll-position change to
  trigger recomposition of that consumer, when wrapping the boolean
  derivation in `derivedStateOf` would only trigger it when the boolean
  itself flips.
- **Modifier chain ordering that doesn't match the intended visual
  result** — e.g. `.clickable { }` placed before `.padding(...)` so the
  padding area isn't clickable, or `.background(...)` placed before
  `.clip(...)` so the background isn't actually clipped to the shape.
  Modifier order is applied sequentially (layout → shape → drawing →
  interaction, roughly), and a swapped order compiles fine while producing
  visibly wrong behavior — flag it as a functional bug, not a style nit,
  when the visual/interaction difference is real.

---

## False-positive traps

- `mutableStateOf` used for genuinely ephemeral, composable-local UI state
  (a text field's current value inside a single composable, not exposed
  outside it) is the *correct*, idiomatic use — the HIGH finding above is
  specifically about a **ViewModel** exposing `mutableStateOf` as its public
  state API, not `remember { mutableStateOf(...) }` used locally inside a
  composable.
- A `LazyColumn` without `key = { it.id }` on a list that is provably
  append-only and never reordered/filtered/spliced (a live log tail) is a
  low-severity nit, not HIGH — cap at MEDIUM and say why, same carve-out the
  Vue lens already applies to `v-for :key="index"` on an append-only list.
- `LaunchedEffect(Unit)` is not a finding when the composable it's in is
  genuinely only ever composed once per logical screen visit (confirm the
  navigation graph doesn't restore/recompose it unexpectedly) — the finding
  is about the specific navigation setups where that assumption is false,
  not `LaunchedEffect(Unit)` as a blanket anti-pattern.
- `@Immutable`/`@Stable` already present on a type is not itself something
  to re-verify exhaustively field-by-field on every review — only re-check
  it when a field was added or changed in the diff under review.

## Escalate to general domain when…

- The finding is about **Clean Architecture layering** (ViewModel doing
  UseCase's job, a domain-layer leak) — `references/android.md`'s job, not
  this lens's.
- The finding is about **generic Kotlin coroutine/lifecycle discipline**
  (`GlobalScope` misuse, missing `viewModelScope`) with no Compose-specific
  recomposition angle — `references/android.md`'s job.
- A recomposition/performance claim needs **actual measurement** (Layout
  Inspector recomposition counts, a baseline profile) to confirm rather than
  static reading — escalate to `performance-audit-edho-ferdian`.
- The finding is a **Gradle/Compose-compiler-plugin build failure** rather
  than a review-time concern — see the Provenance note below for why that
  goes to `build-fix-edho-ferdian/references/android.md`, not a dedicated
  Compose Multiplatform build-fix file.

## Provenance

Adapted from ECC `compose-multiplatform-patterns`, fetched 2026-09-07. **No
dedicated `build-fix-edho-ferdian/references/compose-multiplatform.md`
exists, by deliberate decision, not an oversight:** a Compose Multiplatform
or Jetpack Compose build failure is, underneath, a Gradle build using the
Compose compiler plugin (and, for Compose Multiplatform, the Kotlin
Multiplatform plugin) — the actual failure shapes are Gradle/AGP version-
matrix mismatches, dependency-resolution conflicts, and `expect`/`actual`
target mismatches, all of which `build-fix-edho-ferdian/references/
android.md` already covers, including a dedicated "KMP-specific" table for
the Compose Multiplatform-flavored versions of those errors. Splitting a
separate file would either duplicate that Gradle/AGP material or leave a
near-empty file pointing back at it — the same reasoning
`language-code-review-edho-ferdian`'s own Quarkus-inside-Spring-Boot and
Vue/Nuxt-one-file precedents already establish for this ecosystem: fold a
thin, mostly-overlapping stack into its sibling file with a named
sub-section instead of a new standalone one. If Compose-compiler-specific
build errors (as opposed to Gradle/AGP-level ones) turn out to be common
enough once a real Compose Multiplatform project exists in Edho's workspace
to justify their own section, add a "Compose compiler" table to `android.md`
at that point rather than creating a new file.
