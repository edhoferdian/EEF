# Dart / Flutter — build & compile lens

Adapted from ECC `dart-flutter-patterns` and `rules/dart/hooks.md`, fetched
2026-09-07. `rules/dart/hooks.md`'s suggested PostToolUse checks feed the
diagnostic-command table below; nothing else from that file is build-fix
relevant (it's mostly formatter/analyzer automation already reflected here).

Scope: `flutter analyze`/`dart analyze` errors, Flutter build failures
(debug and release), pub dependency resolution conflicts, and code-generation
(`build_runner`) failures for `freezed`/`json_serializable`/`riverpod_
generator`. Compose Multiplatform and pure-Kotlin/Android build errors are
out of scope here — see `references/android.md`.

## Stack detection

```bash
test -f pubspec.yaml                                  # Dart/Flutter project
grep -q "sdk: flutter" pubspec.yaml                    # Flutter app vs. plain Dart package
test -f pubspec.lock                                   # dependencies resolved at least once
```

## Diagnostic commands

```bash
flutter analyze                        # static analysis — run this first, always
dart analyze --fatal-infos             # stricter pass if the project has enabled strict analyzer settings
flutter pub get                        # resolve/install dependencies
flutter pub deps                       # print the full dependency tree, for conflict diagnosis
flutter pub outdated                   # see what's actually behind, before touching versions
dart run build_runner build --delete-conflicting-outputs   # regenerate .g.dart/.freezed.dart
flutter build apk --debug              # Android build, fastest signal
flutter build ios --no-codesign --debug # iOS build without needing a signing identity
flutter test                           # confirm the fix didn't regress behavior
flutter clean                          # nuke build artifacts — last resort, see Cache-clear recovery below
```

## Resolution workflow

```
1. Run the real command    -> `flutter analyze` or the actual failing build/
                               pub/build_runner command, capture output unedited
2. Identify the layer      -> analyzer/type error / pub resolution / native
                               (Gradle or Xcode) / code generation
3. Read affected file      -> understand context before editing
4. Apply minimal fix       -> only what the error demands
5. Re-run                  -> verify; a NEW error is a fresh diagnosis
6. flutter test            -> confirm no regression
```

## `flutter analyze` / `dart analyze` errors

| Error | Cause | Fix |
|---|---|---|
| `The argument type 'X?' can't be assigned to the parameter type 'X'` | Nullable value passed where the type system requires non-null | Add a null check/guard, `?? default`, or `!` only if genuinely proven non-null at that point |
| `The method 'X' isn't defined for the type 'Y'` | Missing import, wrong type inferred, or a typo in a generated-file member (check `.g.dart`/`.freezed.dart` is up to date first) | Fix the import, or regenerate with `build_runner` if the member should come from codegen |
| `A value of type 'X' can't be returned from method 'Y' because it has a return type of 'Z'` | Return type mismatch, common after refactoring a signature | Update the return type or the returned value to match the intended contract |
| `The non-abstract class 'X' is missing implementations for these members` | A class implementing an interface/abstract class is missing a required override | Implement the missing member(s), or check whether the interface itself changed and the implementer needs updating |
| `Undefined class 'X'` / `Undefined name 'X'` referencing a generated symbol (`_$X`, `XImpl`) | `build_runner` hasn't been run since the annotated class changed | `dart run build_runner build --delete-conflicting-outputs` |
| `Non-nullable instance field 'X' must be initialized` | A `final`/non-nullable field with no initializer and no constructor assignment | Add a constructor parameter, a default value, or make the field nullable if it's genuinely optional |

## Pub dependency resolution conflicts

| Error | Cause | Fix |
|---|---|---|
| `Because X depends on Y ^A which doesn't match any versions, version solving failed` | Two dependencies (or a dependency and the project) require incompatible version ranges of a shared package | `flutter pub deps` to see the actual conflicting constraint chain before guessing which package to bump; bump the leaf dependency with the narrower/older constraint first |
| `The current Dart SDK version is X.X.X. Because Y requires SDK version >=A <B, version solving failed` | Project's Dart/Flutter SDK is older than a dependency's floor | Either upgrade the Flutter SDK (`flutter upgrade` — a real version bump, flag it as such rather than doing it silently) or pin the dependency to an older compatible version |
| `Pub failed to find a resolution` with `dependency_overrides` already present | An existing override is itself now incompatible with a newer transitive constraint | Re-evaluate whether the override is still needed at all before adding a second one on top of it — stacking overrides usually means the real fix is upgrading the overridden package properly |
| Resolution succeeds locally but CI reports a different resolved set | `pubspec.lock` not committed, or `.gitignore` excludes it for an app (apps should commit the lockfile; only pure packages typically don't) | Commit `pubspec.lock` for an application project; confirm CI runs `flutter pub get` against the committed lockfile, not a fresh resolution |

## `build_runner` / code-generation failures

| Error | Cause | Fix |
|---|---|---|
| `Conflicting outputs were detected` | A previous generated file (`.g.dart`/`.freezed.dart`) doesn't match what the current source would generate | `dart run build_runner build --delete-conflicting-outputs` — safe because generated files are regenerated, never hand-edited |
| `build_runner` hangs or times out on a large project | Full rebuild instead of incremental, or a circular part-file dependency | `dart run build_runner watch --delete-conflicting-outputs` during active development instead of one-shot `build`; check for a genuine cycle between `part`/`part of` files if it hangs even incrementally |
| `Freezed` class fails to compile after adding a field | `part 'x.freezed.dart';`/`part 'x.g.dart';` missing from the source file, or codegen not re-run after the field was added | Confirm both `part` directives are present, then regenerate |
| `json_serializable` output doesn't match the expected JSON shape | `@JsonKey` mapping missing for a field whose Dart name differs from the JSON key | Add the explicit `@JsonKey(name: '...')` annotation, then regenerate |

## Native build failures (Flutter's own build, not raw Gradle/Xcode)

| Error | Cause | Fix |
|---|---|---|
| `flutter build apk` fails at the Gradle step | Underlying Android/Gradle/AGP issue, not Flutter-specific | Hand off to `references/android.md`'s Gradle/AGP tables — Flutter's Android build is a Gradle project underneath, so a version-matrix or plugin-conflict error there follows the same diagnosis |
| `flutter build ios` fails at the Xcode/CocoaPods step | Missing `pod install`, a stale `Podfile.lock`, or a signing-identity requirement | `cd ios && pod install`; use `--no-codesign` for a build-only smoke test that doesn't need a real signing identity |
| `MissingPluginException` at runtime for a plugin that builds fine | Plugin's native side registered for one platform but not invoked correctly on the other, or a hot-reload state issue | Full restart (not hot reload) — plugin registration doesn't survive hot reload; if it persists after a full restart, check the plugin actually declares both platform implementations |
| Build succeeds but `flutter run` can't find a connected device/emulator | Toolchain/device detection issue, not a code error | `flutter doctor -v` to see what's actually missing before touching project files — don't misdiagnose a toolchain gap as a build error |

## Cache-clear recovery

Try in order — cheapest first, and **do not run the last one silently**:

```bash
# 1. Clear Flutter's own build cache only
flutter clean && flutter pub get

# 2. Regenerate codegen output fresh
dart run build_runner build --delete-conflicting-outputs

# 3. LAST RESORT — ask the user first, never run unprompted:
#    wipes native build directories too; forces a full native rebuild next time
rm -rf ios/Pods ios/Podfile.lock android/.gradle build/
```

## Anti-suppression reminders specific to this stack

- Never add `// ignore: <rule>` without an inline comment explaining exactly
  why it's a false positive, and never a blanket `// ignore_for_file:` to
  clear one warning across the whole file.
- Never widen a type or add a bang operator (`!`) just to silence an
  analyzer error — narrow the real type or add the missing null guard.
- Never bump the Flutter SDK, Dart SDK, or a dependency's major version to
  clear a resolution conflict without being asked — an unplanned SDK/major
  bump is an architectural decision (per the general loop guard), not a
  build fix, even when `flutter pub get` succeeds afterward.
- Regenerated (`.g.dart`/`.freezed.dart`) files are never hand-edited to
  "fix" a codegen error — if the generated output is wrong, the bug is in
  the annotated source or the generator's config, not the output file.
