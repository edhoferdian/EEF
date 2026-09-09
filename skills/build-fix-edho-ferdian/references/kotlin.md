# Kotlin — Gradle Kotlin DSL, coroutine/Flow compile & KMP target build lens

**FOLD-M.** Kelompok DEFER-backlog: konten padat, plausibel,
tapi **belum ada bukti proyek Android/Kotlin Multiplatform/Ktor aktif** di
workspace Edho saat ini — beda dari lens JavaScript/TypeScript dan Django/
Python (FOLD-P) yang sudah dipakai pada proyek nyata di ekosistem ini. File
ini ditulis proaktif (gate "tunggu proyek nyata" dicabut per keputusan
pemilik ekosistem); perlakukan sebagai diagnostic lens siap-pakai begitu
proyek Android/KMP/Ktor muncul, bukan sebagai sesuatu yang sudah
tervalidasi lapangan.

Scope: Gradle Kotlin DSL (`build.gradle.kts`) configuration errors, Kotlin
compiler errors (`kotlinc`/`compileKotlin`), coroutine/Flow errors that
surface at compile time (not runtime coroutine bugs — those are a review-
lens concern in `language-code-review-edho-ferdian/references/kotlin.md`),
and Kotlin Multiplatform (KMP) target build failures (`expect`/`actual`
mismatches, missing platform source sets, native target toolchain issues).
You fix the error only — you do not restructure module architecture or
change public APIs beyond what the error demands.

## Diagnostic commands

Run these in order to localize the error before touching anything:

```bash
# Confirm toolchain
./gradlew --version
kotlinc -version

# Fast compile-only check of the main source set (quickest feedback loop)
./gradlew compileKotlin

# Full build — confirms the error survives packaging/resource steps too
./gradlew build

# For KMP: compile every target explicitly, one at a time, to isolate
# which target(s) actually fail (a shared commonMain error fails all of
# them; a target-specific error fails only one)
./gradlew compileKotlinJvm
./gradlew compileKotlinIosArm64
./gradlew compileKotlinIosSimulatorArm64
./gradlew compileKotlinAndroid
./gradlew compileKotlinMetadata      # commonMain-only compile, isolates expect/actual mismatches

# Dependency graph state
./gradlew dependencies
./gradlew :module-name:dependencies --configuration compileClasspath

# Gradle's own diagnostic mode when the failure is in Gradle config itself
# rather than Kotlin source (plugin resolution, version catalog, etc.)
./gradlew build --stacktrace
./gradlew build --info
```

## Resolution workflow

```
1. Reproduce the error            -> capture the FULL compiler/Gradle diagnostic,
                                      unedited (Kotlin's compiler messages
                                      routinely name the exact expected type and
                                      the exact actual type — read both before
                                      guessing at a fix)
2. Identify the error family      -> use the tables below
3. Read the affected file(s)      -> understand the surrounding coroutine
                                      scope / expect-actual contract / Gradle
                                      config before editing
4. Apply the minimal fix          -> only what the error demands
5. ./gradlew compileKotlin        -> confirm the specific error is gone
6. ./gradlew build && ./gradlew test  -> confirm nothing else broke
```

**Read the Kotlin compiler's own message fully.** Kotlin's diagnostics
routinely state the exact expected vs. actual type, or name the specific
`expect` declaration an `actual` doesn't satisfy — the fix is usually
already spelled out in the error text, but still read the surrounding code
before applying it verbatim (see Anti-suppression reminders below).

## Gradle Kotlin DSL configuration errors

| Error | Cause | Fix |
|---|---|---|
| `Plugin [id: 'X', version: 'Y'] was not found` | Plugin not published under that id/version, or the plugin repository isn't declared in `settings.gradle.kts`'s `pluginManagement { repositories { } }` | Verify the exact id/version on the Gradle Plugin Portal; confirm `gradlePluginPortal()`/`mavenCentral()` is listed |
| `Unresolved reference` inside `build.gradle.kts` itself (not application code) | A `.gradle.kts` script is itself Kotlin and gets type-checked; a typo'd DSL function/property, or a plugin's extension function not applied yet at that point in the script | Check plugin application order — an extension function from a plugin (e.g. `kotlin { }`, `android { }`) is only available after `plugins { }` applies that plugin |
| `Could not resolve all files for configuration ':module:compileClasspath'` | A declared dependency doesn't exist at that version/coordinate, or a private repository needs credentials not configured | `./gradlew :module:dependencies --configuration compileClasspath` to see the resolution attempt; verify coordinates on Maven Central/the declared repository |
| `Duplicate class found in modules` | Two dependencies (often a JVM library indirectly pulling in a KMP artifact's JVM variant, or a transitive version conflict) ship the same class | `./gradlew app:dependencies` to find both sources; exclude the duplicate transitive dependency or align versions |
| `Kotlin Gradle Plugin` version mismatch warning/error across modules in a multi-module build | Each module declared a different Kotlin plugin version instead of using a single version catalog entry | Consolidate to one Kotlin version via `gradle/libs.versions.toml`, applied consistently across every module |
| `The Kotlin compiler was not found` / toolchain resolution failure | `jvmToolchain(N)` requests a JDK version Gradle can't locate or auto-provision | Confirm the toolchain resolver plugin is applied (`org.gradle.toolchains.foojay-resolver-convention` in `settings.gradle.kts`), or install/point to a matching JDK explicitly |

```bash
./gradlew :module:dependencies --configuration compileClasspath
./gradlew buildEnvironment          # full plugin classpath resolution
```

## Kotlin compiler errors

| Error | Cause | Fix |
|---|---|---|
| `Type mismatch: inferred type is X but Y was expected` | Genuine type error, or (very common) a nullable type flowing into a non-nullable parameter | Read exactly which of X/Y is nullable — the fix is almost always a safe call, Elvis default, or explicit null check, not a cast |
| `Smart cast to 'X' is impossible, because 'y' is a var property that could have been changed by another thread` | A `var` property (not `val`, and not a local variable) was smart-cast after a null check — Kotlin can't guarantee no concurrent mutation between the check and the use | Copy to a local `val` first (`val local = y ?: return; use(local)`), don't rely on smart-cast for mutable properties |
| `Unresolved reference: X` where X is a real extension function from a library | The library providing the extension isn't imported, or (for `kotlinx.coroutines`/`kotlinx.serialization`) the corresponding Gradle dependency is missing entirely | Add the `import`; if the symbol truly doesn't resolve after that, check the dependency is actually declared, not just present transitively |
| `This class does not override 'equals()'` warning promoted to error under stricter lint/detekt config | A regular `class` used as a value/key where `data class` (or explicit `equals`/`hashCode`) was intended | Convert to `data class` if it's a value holder, or implement `equals`/`hashCode` explicitly if there's a reason it isn't one |
| `Suspension functions can be called only within coroutine body` | A `suspend fun` called from a non-suspending context (a regular function, a lambda that isn't itself `suspend`, a synchronous callback) | Wrap the call site in a coroutine builder (`launch`/`async` from an appropriate scope) or mark the calling function `suspend` if it's itself only ever called from suspend context |
| `'when' expression must be exhaustive` | A `when` over a `sealed class`/`sealed interface`/`enum class` is missing a branch for a variant/entry | Add the missing branch — this is the compiler doing exactly what sealed hierarchies are for; do not silence it with a blanket `else ->` unless that variant is genuinely meant to be handled generically |
| `Platform declaration clash` | Two functions that differ only in a way the JVM erases (e.g. differing only in a `value class` parameter that gets inlined to its underlying type) produce identical JVM signatures | Rename one function, or add `@JvmName` to disambiguate the generated bytecode signature |

```bash
# Show the exact Kotlin/JVM target and language version in effect
./gradlew properties | grep -i kotlin
```

## Coroutine / Flow compile-time errors

| Error | Cause | Fix |
|---|---|---|
| `Suspend function 'X' should be called only from a coroutine or another suspend function` | Same family as the general suspension error above, specific to calling a suspend function from `runBlocking`-free synchronous code (e.g. a Ktor route lambda that isn't itself a suspend lambda, an Android `onClick` listener) | Most Ktor/Android callback lambdas used with coroutines already are suspend-compatible (Ktor route handlers, `lifecycleScope.launch { }` bodies) — confirm you're inside one of those, not a genuinely synchronous callback |
| `Type mismatch: inferred type is Flow<X> but Flow<Y> was expected` | A `map`/`transform` operator changed the emitted type without the consuming code being updated, or a `StateFlow<X>` was passed where a plain `Flow<Y>` (different X) was expected | Trace the operator chain from source to the mismatched consumption point; the fix is almost always one missing/misplaced `.map { }` |
| `Unresolved reference: await` / `Unresolved reference: launch` on what looks like a valid coroutine builder | Missing `kotlinx-coroutines-core` dependency for that source set (common in KMP when a dependency was added to `jvmMain` but the failing code lives in `commonMain`) | Check which source set declared the `kotlinx-coroutines-core` dependency vs. which source set the failing file lives in |
| `'CoroutineScope' is not a member of` (on `this` inside a class) | Calling `launch`/`async` directly inside a class that doesn't implement `CoroutineScope` and isn't inside a coroutine builder's receiver | Inject or provide a `CoroutineScope` explicitly (`viewModelScope`, a constructor-injected scope) rather than trying to call builders on an arbitrary class instance |

## Kotlin Multiplatform (KMP) target build failures

| Error | Cause | Fix |
|---|---|---|
| `Expected function 'X' has no actual declaration in module for platform Y` | An `expect fun`/`expect class` in `commonMain` has no matching `actual` in one of the target source sets (often a newly added target that hasn't had its `actual`s written yet) | Add the missing `actual` in every target source set listed in the error; `./gradlew compileKotlinMetadata` isolates exactly this class of error without needing a full multi-target build |
| `Actual function 'X' has no corresponding expected declaration` | An `actual` exists in a platform source set with no matching `expect` in `commonMain` — usually a naming/signature mismatch (parameter type, nullability) rather than a truly missing `expect` | Diff the `actual` signature against the `expect` signature character-by-character — nullability and default-parameter differences are the most common silent mismatch |
| `Could not determine the dependencies of task ':module:linkDebugFrameworkIosArm64'` (or similar native task) | Missing or misconfigured native toolchain (Xcode command-line tools, or a `cinterop` definition pointing at a header that doesn't exist on this machine) | On non-macOS hosts, iOS targets generally cannot compile at all — confirm this target is even expected to build here before treating it as a bug to fix (relevant on Edho's Windows-only environment: iOS/macOS KMP targets are not buildable locally at all, only JVM/Android/JS targets are) |
| `Module was compiled with an incompatible version of Kotlin` (KMP library consumed across a Kotlin version gap) | A KMP library's published `.klib` was built with a newer/older Kotlin compiler than the consuming project uses | Align the project's Kotlin version with what the library's `.klib` requires (check the library's release notes), rather than trying to force-compile against a mismatched version |
| `Could not find "org.jetbrains.kotlin-multiplatform" plugin` (or `-android`/`-jvm` variant) | `settings.gradle.kts` doesn't apply the KMP plugin, or applies a JVM-only Kotlin plugin to a module meant to be multiplatform | Verify `kotlin("multiplatform")` is applied (not `kotlin("jvm")`) in the module's `build.gradle.kts`, and that the plugin version is pinned via the version catalog |

```bash
# Isolate expect/actual mismatches without a full multi-target build
./gradlew compileKotlinMetadata

# List every configured KMP target for the module
./gradlew :module:targets
```

## Dependency resolution (Gradle / version catalog)

| Error | Cause | Fix |
|---|---|---|
| `Cannot find a version that satisfies the version constraints` | Two modules/libraries require incompatible version ranges of the same dependency (common with `kotlinx-coroutines`/`kotlinx-serialization` pinned differently across modules) | `./gradlew :module:dependencies` to find every requirer, then consolidate on one version via the version catalog (`gradle/libs.versions.toml`) rather than pinning per-module |
| `libs.versions.toml` entry not resolving (`Unresolved reference: libs`) | The version catalog isn't wired up in `settings.gradle.kts` (`versionCatalogs { create("libs") { ... } }` or the default `libs.versions.toml` auto-detection), or a module's `build.gradle.kts` doesn't have catalog access | Confirm `settings.gradle.kts` includes the module in `dependencyResolutionManagement`, and that the catalog file is at the default `gradle/libs.versions.toml` path |
| `Cannot change dependencies of configuration ':module:compileClasspath' after it has been resolved` | A `build.gradle.kts` script adds a dependency conditionally, after Gradle has already started resolving that configuration (common with dynamic/scripted dependency logic) | Move the dependency declaration to unconditional `dependencies { }` block evaluation, or use `configurations.all { }` hooks designed for this rather than late mutation |

```bash
./gradlew :module:dependencies --configuration compileClasspath
./gradlew dependencyInsight --dependency kotlinx-coroutines-core --configuration compileClasspath
```

## Anti-suppression reminders specific to this stack

- Never add `!!` to silence a "type mismatch: nullable vs non-nullable"
  compiler error — that converts a compile-time-caught issue into a
  runtime `NullPointerException` waiting to happen; use a safe call, Elvis
  default, or explicit null check instead (see the review lens's CRITICAL
  section on this exact pattern).
- Never add a blanket `else ->` to make a "when expression must be
  exhaustive" error disappear on a `sealed class`/`sealed interface` you
  own — that's the compiler protecting you from forgetting to handle a new
  variant later; handle the case, or explicitly justify the catch-all if
  the domain genuinely calls for one.
- Never wrap a suspend-context compile error in `runBlocking { }` purely to
  make the caller "synchronous enough" to compile — `runBlocking` inside
  already-suspending code (a coroutine, a Ktor route, an Android main
  thread callback) blocks a thread that structured concurrency was
  specifically trying to keep free; fix the caller to be suspend/coroutine-
  aware instead.
- Never bump the project's Kotlin language/API version, or force a KMP
  library to a mismatched version via a forced dependency resolution
  strategy, to work around a compiler or `.klib` compatibility error
  without flagging it to the user first — that's an architectural/scope
  decision, not a build fix, even when it "just works" locally.
- Never delete or skip a KMP target from `build.gradle.kts` to make a build
  pass, when the actual root cause is a missing `actual` declaration or a
  toolchain that simply isn't installed on this machine — removing the
  target silently changes what the project ships. Flag the missing
  toolchain/`actual` explicitly instead.

---

## Provenance

Gradle/KMP diagnostic tables beyond the direct source examples (plugin
resolution, `expect`/`actual` mismatch errors, version-catalog
troubleshooting) are synthesized from standard Gradle/Kotlin toolchain
behavior in the same spirit as this skill's `rust.md`/`go.md` diagnostic
tables, not copied verbatim from any single source — the review/TDD-
oriented Kotlin reference material this draws context from does not carry
a build-fix diagnostic table of its own.
