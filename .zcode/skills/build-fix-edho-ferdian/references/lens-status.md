# Lens status, per-stack history, and provenance

Moved out of `SKILL.md` so the build-fix loop loads lean. Nothing here is
needed to fix a build — the routing list and every rule stay in `SKILL.md`.
Open this file when deciding how much to trust a lens (FOLD-M vs
field-proven), when adding a new stack, or when auditing where a lens's
content came from.

## Provenance

This `SKILL.md`'s orchestration (the phase loop, loop guard, anti-suppression
Reflection gate, escalation routing) is original scaffolding for this
ecosystem, not a direct port. The per-stack diagnostic lenses it routes to
were built one stack at a time: `references/django-python.md`, and
`references/javascript-typescript.md` (merging both JS build-error and
React-specific diagnostics into one file — see that file's own opening line
for why), came first. `references/go.md` and `references/rust.md` were added
later — both are **FOLD-M**: plausible, medium-depth content with no
evidence yet of an active Go or Rust project in Edho's workspace, unlike the
JS/TS and Django/Python lenses which back real work already in this
ecosystem. The stacks listed under "Stacks built (FOLD-M, ahead of trigger)"
below carry the same FOLD-M status for the same reason — built
ahead of any evidence of an active project in that stack, not withheld
pending one.

## Stacks built (FOLD-M, ahead of trigger)

The original 34-item DEFER backlog gated every stack below on "a real
project in that stack appears." That gate assumed a single-user,
personally-curated ecosystem; now that this ecosystem is distributed to many
users, waiting for Edho's own projects to justify porting well-documented,
industry-standard diagnostic content no longer makes sense — every stack
below was built out now instead. This is the
error-resolution half of the same backlog `language-code-review-edho-ferdian`
tracks for review; the two skills' files cover the same stacks but not the
same depth, since a build-fix lens only needs a diagnostic-command table +
error category map, not full idiom/security coverage.

- **PHP/Laravel** — `references/laravel.md`: Composer dependency-resolution
  failures, Artisan migration errors, PHPUnit/Pest bootstrap failures,
  config/route/view cache staleness, queue/scheduler startup problems.
  Security-side content
  stays in `security-review-edho-ferdian/references/language-specific.md`
  §"PHP / Laravel" — out of this skill's scope regardless.
- **Java/Spring + Quarkus** — `references/java-spring.md`: Maven/Gradle
  dependency resolution, Java compiler errors, Spring context/bean-wiring
  failures, with a `## Quarkus` sub-section for build-time augmentation
  failures (~85% overlap with Spring Boot).
- **Kotlin** — `references/kotlin.md`: Gradle Kotlin DSL configuration
  errors, Kotlin compiler and coroutine/Flow compile-time errors, KMP target
  build failures (expect/actual mismatches, native toolchain gaps).
- **Swift/Apple** — `references/swift.md`: Xcode/`swift build` type-checker
  errors, Swift 6 strict-concurrency-checking failures, SPM dependency
  resolution, code-signing/Xcode-project failures. Ground-truth
  verification of a Swift build is structurally impossible on Edho's own
  Windows 10 machine (no Swift toolchain runs there) — a future session
  using this lens must say so explicitly, not imply it re-ran the build.
- **Mobile cross-platform** — `references/react-native.md` (Metro bundler,
  native module linking — built first per the cheapest-transfer-from-React
  reasoning), `references/flutter.md` (Flutter/Dart build and pub dependency
  errors), `references/android.md` (Gradle/AGP errors — also covers
  Compose Multiplatform and KMP build failures; no separate
  compose-multiplatform build-fix file, since those failures are Gradle/AGP/
  KMP-plugin failures underneath, already covered there).
- **.NET** — `references/dotnet.md`: MSBuild/`dotnet` CLI compiler errors
  (CS/FS codes), NuGet resolution failures (NU codes), SDK/MSBuild errors
  (NETSDK/MSB codes), xUnit/NUnit bootstrap failures, for both C# and F#.
- **C++** — `references/cpp.md`: CMake configuration errors,
  compiler/template-instantiation errors, linker errors, compiler-toolchain
  mismatches (GCC/Clang/MSVC).
- **PyTorch** — `references/pytorch.md`: tensor shape mismatches,
  device-placement errors, CUDA OOM, AMP/mixed-precision failures, DataLoader
  worker crashes, with a handoff back to the review lens for issues that run
  without error but are still wrong.
- **ArkTS/HarmonyOS** — `references/arkts.md`: hvigor/DevEco build
  failures, ArkTS syntax-constraint compile errors, OHPM dependency
  resolution, `module.json5` config errors.
- **Perl** — `references/perl.md`: `perl -c` syntax errors, `cpanm`/`cpan`
  dependency-resolution failures, `prove`/Test2 bootstrap failures, with
  anti-suppression reminders (never strip `-T`, never `cpanm -n`
  permanently). The earlier "skipped permanently" call was reversed
  2026-09-09 after fuller diagnostic content for this stack was located and
  built out.
- **Ruby / Rails** — `references/ruby.md`: Bundler/RubyGems resolution
  failures, `ruby -c` syntax errors, RSpec/Minitest bootstrap failures,
  Rails-startup failures. Ground-truth commands are sourced from
  `rules/ruby/hooks.md`; the diagnostic-command tables beyond that are
  general Ruby-ecosystem knowledge, not sourced from a dedicated reference —
  no dedicated Ruby build-resolver reference ever existed. Say so if asked,
  don't imply deeper sourced provenance than this has.
