# React Native / Expo — build & compile lens

`rules/react-native/hooks.md`'s pre-release check list feeds the
diagnostic-command table below.

Scope: Metro bundler failures, native module linking failures, TypeScript
errors in `.ts`/`.tsx` RN/Expo code, Expo/EAS build and config errors, and
New-Architecture (Fabric/TurboModules) compatibility failures. This file
assumes the **managed Expo workflow** (Expo Router, EAS, `expo-*` modules);
a bare RN app (`android/`/`ios/` folders, no `expo` dependency) hits the same
Metro/native-module failure shapes but skips every EAS-specific section
below — check for an `expo` dependency in `package.json` before assuming EAS
applies.

**Requires:** for TypeScript/JSX type errors that have nothing to do with
Metro or native modules specifically, check
`references/javascript-typescript.md`'s generic TypeScript/JSX tables first —
this file only adds what's **RN/Expo-specific**: Metro's own bundling model,
native module linking, and Expo/EAS tooling.

## Stack detection

```bash
grep -l '"expo"' package.json                 # managed Expo workflow
test -d android -a -d ios                     # bare RN (or a prebuilt Expo app)
grep -l '"react-native"' package.json          # RN present either way
```

## Diagnostic commands

```bash
npx tsc --noEmit --pretty                     # type errors, independent of Metro
npx expo start --clear                        # clear Metro's transform cache, then reproduce
npx expo-doctor                                # Expo/native dependency health + config validation
npx expo install --check                       # native deps aligned with the installed Expo SDK
npx expo run:android                           # bare/prebuild native Android build
npx expo run:ios                               # bare/prebuild native iOS build
eas build --profile development --local        # reproduce an EAS build failure locally before escalating
npm ls react react-native                      # confirm exactly one resolved copy of each
```

## Resolution workflow

```
1. Run the actual failing command  -> capture full error output, unedited
   (Metro dev server error overlay, `expo run:*` native build log, or
   `eas build` log — don't paraphrase from a truncated terminal tail)
2. Identify the layer     -> Metro/JS bundling / native module linking /
                              TypeScript / Expo config / EAS build
3. Read affected file      -> understand context before editing
4. Apply minimal fix       -> only what the error demands
5. Re-run                  -> verify; a NEW error is a fresh diagnosis
6. Run tests if present    -> npx jest, confirm no regression
```

## Metro bundler errors

| Error | Cause | Fix |
|---|---|---|
| `Unable to resolve module X from Y` | Module genuinely not installed, a path-alias not mirrored in Metro's resolver config, or a stale Metro cache | Check `node_modules` + lockfile first (real absence beats guessing), then `metro.config.js` `resolver.extraNodeModules`/`resolver.alias`, then `npx expo start --clear` |
| `Metro has encountered an error: ... while trying to load ... .flow` / a `.ts` file Metro tried to parse as Flow | Metro's default resolver picked up a type-only or Flow-annotated file it shouldn't bundle | Check `metro.config.js` `resolver.sourceExts`/`resolver.assetExts`, and that a monorepo's `watchFolders` isn't pulling in the wrong package |
| `Requiring unknown module "N"` at runtime, or a runtime `undefined is not a function` for something that type-checks fine | Metro's cache is serving a stale bundle after a rename/delete | `npx expo start --clear` (clears Metro's transform cache) before any other fix |
| `SHA-1 for file ... has changed without a corresponding change to the man-in-the-middle cache` (watchman) | Watchman's file-watch cache is desynced from disk | `watchman watch-del-all && npx expo start --clear` |
| Symlinked monorepo package not picked up / stale after edit | Metro doesn't follow symlinks by default in some configurations | Set `resolver.unstable_enableSymlinks: true` (or the current Expo/Metro equivalent) in `metro.config.js`; confirm the Metro version actually supports it before assuming it's missing |
| Build succeeds but a change to a shared/linked package doesn't show up | `watchFolders` in `metro.config.js` doesn't include the linked package's directory | Add the package's real (non-symlinked) path to `watchFolders` |

## Native module linking failures

| Error | Cause | Fix |
|---|---|---|
| `TurboModuleRegistry.getEnforcing(...): 'X' could not be found` | Native module not linked for the New Architecture, or autolinking didn't pick it up | Run `npx expo install --check`, then `npx pod-install` (iOS) / clean-rebuild `android/` (Android); confirm the package's own docs state New-Architecture support before assuming it's a config error on your end |
| `Invariant Violation: Native module cannot be null` (old/bridge-based error shape) | Same root cause as above, pre-Fabric wording | Same fix — this is the legacy-architecture version of the TurboModule error above |
| A native dependency crashes or no-ops only after enabling the New Architecture | The dependency itself hasn't shipped New-Architecture support yet | Check the package's changelog/issues for New-Arch status before assuming your integration is wrong; this is a dependency-compatibility blocker, not a config typo — escalate per the loop guard below if no compatible version exists |
| `Could not find a declaration file for module 'X'` for a native module with no bundled types | Missing `@types/*` package, or the module ships no types at all | Install the `@types/*` package if one exists, or add a minimal local `.d.ts` declaration — do not blanket `// @ts-ignore` the import |
| iOS build fails after adding a native dependency: `library not found for -lX` / CocoaPods resolution error | Pods not installed/updated after a native dependency change | `cd ios && pod install`, or `npx expo prebuild --clean` on a managed project regenerating native projects |
| Android build fails after adding a native dependency: `Duplicate class` / Gradle resolution conflict | Two versions of the same native Android dependency pulled in transitively | `./gradlew app:dependencies` to find the conflicting versions, then align them via a Gradle `resolutionStrategy` or by bumping the offending package — see `references/android.md` for the general Gradle/AGP conflict-resolution approach, since this is the same class of failure once it reaches Gradle |

## Expo config & New-Architecture errors

| Error | Cause | Fix |
|---|---|---|
| `expo-doctor` reports a native dependency without New Architecture support | Package hasn't been updated for Fabric/TurboModules | On SDK 55+ this is a hard blocker (New Arch can't be disabled) — find a maintained alternative or vendor a patched fork; on SDK 53–54 it can still opt out, but that's a temporary escape hatch, not a fix |
| `app.config.js`/`app.json` plugin error: `PluginError: Package "X" does not contain a valid config plugin` | Config plugin not exported correctly, or referenced by the wrong path | Check the plugin package's `app.plugin.js` entry point; confirm the plugin name in `app.json` `"plugins"` matches exactly |
| EAS Build fails at the "Install dependencies" step with a lockfile mismatch | `package-lock.json`/`yarn.lock`/`pnpm-lock.yaml` out of sync with `package.json`, or committed lockfile from a different package manager than the project uses | Regenerate the lockfile locally with the project's actual package manager and commit it — never let EAS silently pick a package manager by guessing |
| EAS Build fails only in CI, passes locally | An `EXPO_PUBLIC_*`/build-time env var set locally but not in the EAS project's environment/secrets | Confirm every var the build reads is also configured in `eas.json`/EAS secrets, not just a local `.env` |

## Duplicate-React/React-Native-instance errors

```bash
npm ls react           # should show exactly ONE resolved version
npm ls react-native     # same — a duplicate here is a common monorepo footgun
npm dedupe
```

Same failure class as the web JS/TS lens's "Invalid hook call" section — a
library throwing on hook usage with no obvious conditional-hook cause in your
own code means duplicated `react` (or `react-native` itself, more common here
than on web due to monorepo/workspace setups) before anything else. Fix with
`resolutions`/`overrides` in `package.json`, and when upgrading, bump `react`,
`react-dom` (if present), and `react-native` **together as a matched set** —
check Expo's SDK compatibility table for the exact versions a given Expo SDK
expects rather than upgrading blind.

## Anti-suppression reminders specific to this stack

- Never blanket-disable a native module's type errors with `// @ts-nocheck`
  on the whole file — scope any necessary suppression to the one line, with
  a comment naming the actual missing-types issue.
- Never silence a New-Architecture incompatibility by disabling the New
  Architecture project-wide as a "fix" without flagging it as a scope
  decision — on SDK 55+ this isn't even available, and on 53–54 it's a
  regression that trades a build error for a shipped incompatibility.
- Never bump `react-native`, `expo`, or a native dependency's major version
  to clear a linking error without being asked — an unplanned SDK bump is an
  architectural decision (per the general skill's loop guard), not a build
  fix, even when it "just works."
- `npx expo prebuild --clean` regenerates native project files and can
  silently discard manual native-code edits under `ios/`/`android/` in a
  managed project — confirm nothing hand-edited lives there before running
  it, or escalate instead of running it unprompted.
