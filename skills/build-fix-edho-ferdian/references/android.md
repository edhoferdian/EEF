# Android / Kotlin / KMP — Gradle & AGP build lens

Adapted from ECC `android-clean-architecture` and `rules/kotlin/patterns.md`,
fetched 2026-09-07. Neither source is itself a build-error-resolver agent —
this file's diagnostic-command tables are derived from the module-structure
and DI conventions those files document (a Gradle multi-module Clean
Architecture layout has a predictable set of failure shapes: module
dependency-graph errors, DI-graph wiring errors, and the AGP/Kotlin version
matrix), not ported line-for-line from an ECC build-fix skill, since ECC
doesn't ship one specifically for Android/Gradle.

Scope: Gradle build/sync failures, Android Gradle Plugin (AGP) version
issues, Kotlin/AGP/Gradle version-matrix mismatches, dependency-resolution
conflicts across Gradle modules, and DI-graph wiring failures (Koin/Hilt)
that surface as build or startup crashes. **This file also covers Kotlin
Multiplatform (KMP) and Compose Multiplatform Gradle build failures** —
KMP/Compose-Multiplatform build errors are Gradle/Kotlin-multiplatform-plugin
errors underneath, the same failure shapes as a plain Android module with an
extra target-configuration axis (see §KMP-specific below) — there is no
separate `compose-multiplatform` build-fix file; see the Provenance note in
`language-code-review-edho-ferdian/references/compose-multiplatform.md` for
why that was a deliberate decision, not an oversight.

## Stack detection

```bash
test -f build.gradle.kts -o -f build.gradle             # Gradle project
grep -l "com.android.application\|com.android.library" **/build.gradle.kts  # Android module(s)
grep -l "org.jetbrains.kotlin.multiplatform" **/build.gradle.kts            # KMP module(s)
grep -l "org.jetbrains.compose\|compose.multiplatform" **/build.gradle.kts  # Compose Multiplatform
```

## Diagnostic commands

```bash
./gradlew build --stacktrace          # full build, with a real stack trace instead of a truncated summary
./gradlew assembleDebug                # fastest signal for an Android app module
./gradlew :module:dependencies         # print one module's resolved dependency tree
./gradlew :module:dependencyInsight --dependency <name>   # trace exactly why a specific version won
./gradlew --refresh-dependencies build # force re-resolution, bypassing Gradle's dependency cache
./gradlew lint                         # Android Lint — manifest/resource-level errors
./gradlew clean build                  # clears Gradle's build outputs (not the dependency cache) then rebuilds
```

## Resolution workflow

```
1. Run the real Gradle command  -> `./gradlew build --stacktrace`, capture
                                    the FULL output — Gradle often prints the
                                    real cause several screens above the
                                    final "BUILD FAILED" summary
2. Identify the layer            -> Gradle/AGP config / Kotlin compiler /
                                     dependency resolution / DI wiring
3. Read affected file            -> understand context before editing
4. Apply minimal fix             -> only what the error demands
5. Re-run                        -> verify; a NEW error is a fresh diagnosis
6. ./gradlew test                -> confirm no regression
```

## Gradle / AGP version-matrix mismatches

AGP, Gradle, and the Kotlin Gradle plugin each declare compatible ranges for
each other, and all three ship new majors on their own release cadences —
**don't rely on memorized version numbers**, they drift with every AGP/
Gradle/Kotlin release. Confirm the actual compatible ranges before assuming
a fix:

```bash
./gradlew --version                    # prints the Gradle version in use
cat gradle/wrapper/gradle-wrapper.properties  # the pinned Gradle distribution
grep -E "agp|com.android.application|kotlin" gradle/libs.versions.toml       # version catalog, if used
```

Typical symptom when the trio is mismatched:

```
The project is using an incompatible version (AGP X.X.X) of the
Android Gradle plugin. Latest supported version is Y.Y.Y
```

or a Kotlin compiler crash with no clear Kotlin-code cause — often actually
an AGP/Kotlin-plugin version pairing issue, not a real compile error. Fix:
align the Gradle wrapper version, AGP version, and Kotlin Gradle plugin
version to a matrix combination the tooling documents as compatible — bump
whichever of the three is oldest first, rather than guessing which one to
downgrade.

## Dependency resolution conflicts

| Error | Cause | Fix |
|---|---|---|
| `Duplicate class X found in modules Y and Z` | Two dependencies (often one direct, one transitive) ship the same class, usually from two different versions/artifacts of the same library | `./gradlew :module:dependencyInsight --dependency <name>` to find both sources, then exclude the transitive one or align versions via the version catalog/`resolutionStrategy` |
| `Could not resolve X. Required by: project :module` with no network issue | Version conflict the resolver can't reconcile, or a repository (Maven/Google) missing from `settings.gradle.kts` `dependencyResolutionManagement` | Check `repositories { }` includes `google()` and `mavenCentral()`; then check the actual version constraint conflict with `dependencyInsight` |
| `Execution failed for task ':module:checkDebugDuplicateClasses'` | Same root cause as the "Duplicate class" row above, surfaced by AGP's own dedicated check task | Same fix — exclude or align the conflicting artifact |
| A dependency resolves to different versions in `debug` vs `release` builds inexplicably | A build-variant-specific dependency block (`debugImplementation`/`releaseImplementation`) pulling in a different version than expected | Check for a variant-specific dependency override before assuming a version-catalog bug |
| `More than one file was found with OS independent path 'META-INF/...'` | Two dependencies package a conflicting resource under the same JAR path | Add a `packaging { resources { excludes += "META-INF/..." } }` rule (AGP 8+) targeting the specific conflicting path — not a blanket exclude of the whole `META-INF` directory |

## DI-graph wiring failures (Koin / Hilt)

| Error | Cause | Fix |
|---|---|---|
| Koin: `No definition found for type 'X'` at runtime | A module wasn't loaded (`startKoin { modules(...) }` missing the module), or the requested type was registered under a different type/qualifier | Confirm the module is actually included in the `modules(...)` list used at app startup; check for a qualifier mismatch between registration and injection site |
| Koin: `Definition already exists` when starting Koin in a test | A previous test's `startKoin`/module registration wasn't torn down (`stopKoin()`) before the next test started | Call `stopKoin()` in `@After`/test teardown, or use Koin's test-specific `KoinTest` helpers that manage this automatically |
| Hilt: `[Dagger/MissingBinding] X cannot be provided` | A required binding has no `@Provides`/`@Binds` anywhere in the accessible Hilt component, or the binding exists in a component that doesn't reach the injection point | Confirm which `@InstallIn(...)` component the binding needs to live in, matching where it's actually injected (a `ViewModelComponent`-scoped binding isn't visible to a plain `SingletonComponent` injection site) |
| Hilt: `@AndroidEntryPoint` class doesn't compile / injection fields stay null | The Activity/Fragment/Application isn't correctly annotated up the chain (an `Application` missing `@HiltAndroidApp`, or a Fragment's hosting Activity missing `@AndroidEntryPoint`) | Confirm the full chain: `Application` → `@HiltAndroidApp`, Activity → `@AndroidEntryPoint`, Fragment → `@AndroidEntryPoint` — Hilt requires every level, not just the leaf class |
| `kaptGenerateStubsDebugKotlin` / KSP failure referencing a Hilt/Room-generated symbol | Annotation processor (KAPT/KSP) output stale after a signature change | `./gradlew clean` before rebuilding — generated-code staleness is common enough after a DI/entity signature change to try before deeper diagnosis |

## Room / SQLDelight build-time errors

| Error | Cause | Fix |
|---|---|---|
| `Room cannot verify the data integrity. Looks like you've changed schema but forgot to update the version number` | `@Database(version = N)` not bumped after an `@Entity` schema change | Bump the version and provide a `Migration`, or (dev-only, never in a shipped release) `fallbackToDestructiveMigration()` as an explicit, temporary, flagged decision |
| `Cannot find implementation for X. AbstractDao does not exist` | Room's annotation processor (KSP/KAPT) hasn't run, or ran against stale generated code | `./gradlew clean` then rebuild; confirm the `ksp`/`kapt` dependency for Room's compiler is actually declared |
| SQLDelight: `.sq` file fails to compile with a SQL syntax error at build time | Genuine SQL error in the `.sq` file — SQLDelight validates SQL at compile time, unlike raw Room queries in annotations | Fix the SQL directly; treat this as SQLDelight doing its job, not a tooling bug |

## KMP-specific (Kotlin Multiplatform / Compose Multiplatform)

| Error | Cause | Fix |
|---|---|---|
| `Could not resolve org.jetbrains.kotlin:kotlin-stdlib-common` or a target-specific stdlib resolution failure | A `commonMain` dependency was declared without checking it ships a target for every platform the module targets (`androidTarget()`, `iosX64()`, etc.) | Confirm the dependency publishes artifacts for every declared target before adding it to `commonMain.dependencies` — a JVM-only or Android-only library in `commonMain` fails exactly this way |
| `expect`/`actual` mismatch: `Actual declaration has no corresponding expected declaration` (or vice versa) | An `actual` implementation added for one platform source set without a matching `expect` in `commonMain`, or the signatures don't match exactly | Confirm the `expect` declaration exists in `commonMain` and every `actual` across every target source set matches its signature exactly |
| Compose Multiplatform: `Unresolved reference` for a `@Composable` function only on iOS/Desktop target, not Android | The composable (or a dependency it uses) isn't available on that target — a common gap when porting an Android-only Compose codebase to Compose Multiplatform | Check whether the underlying dependency has a Compose Multiplatform artifact for that target at all, or needs an `expect`/`actual` wrapper for the platform-specific parts |
| Convention-plugin (`build-logic/`) change doesn't take effect | Gradle's included-build cache for `build-logic` is stale | `./gradlew --stop` (kill the Gradle daemon) then rebuild — a convention-plugin change sometimes needs the daemon restarted, not just `clean` |

## Cache-clear recovery

Try in order — cheapest first, and **do not run the last one silently**:

```bash
# 1. Clear this project's build outputs only
./gradlew clean

# 2. Force dependency re-resolution, bypassing Gradle's cache
./gradlew --refresh-dependencies build

# 3. Restart the Gradle daemon (fixes convention-plugin/daemon-state staleness)
./gradlew --stop

# 4. LAST RESORT — ask the user first, never run unprompted:
#    wipes Gradle's global dependency/build cache, forces a full re-download
rm -rf ~/.gradle/caches/
```

## Anti-suppression reminders specific to this stack

- Never add `@Suppress("...")` without a comment naming exactly why it's a
  false positive, and never a blanket `@file:Suppress(...)` to clear one
  warning.
- Never bump AGP, Gradle, or the Kotlin plugin version to clear a build
  error without being asked — an unplanned toolchain bump is an
  architectural decision (per the general loop guard), even when it "just
  works," since it can shift the whole version matrix for every module.
- Never add a `resolutionStrategy.force(...)` to silently pin a conflicting
  dependency's version without checking whether the forced version is
  actually compatible with what depends on it — a forced version that
  compiles can still break at runtime if an API it needs isn't present in
  the forced version.
- `fallbackToDestructiveMigration()` on a Room database is a data-loss
  operation on any device that already has the app installed — treat adding
  it as a scope decision requiring explicit confirmation, never a silent
  "fix" for a schema-version error.
