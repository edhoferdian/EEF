# ArkTS / HarmonyOS — hvigor build, ArkTS compile & module-dependency lens

**FOLD-M.** Kelompok DEFER-backlog: konten padat, plausibel,
tapi **belum ada bukti proyek HarmonyOS/ArkTS aktif** di workspace Edho saat
ini — beda dari lens JavaScript/TypeScript dan Django/Python (FOLD-P) yang
sudah dipakai pada proyek nyata di ekosistem ini. File ini ditulis proaktif
(gate "tunggu proyek nyata" dicabut per keputusan pemilik ekosistem, closing
the ArkTS/HarmonyOS placeholder note in this skill's own SKILL.md);
perlakukan sebagai diagnostic lens siap-pakai begitu proyek HarmonyOS
muncul, bukan sebagai sesuatu yang sudah tervalidasi lapangan.

Scope: DevEco Studio / hvigor build failures, ArkTS type-checking and
syntax-constraint compile errors, `oh-package.json5`/OHPM (OpenHarmony
Package Manager) dependency resolution failures, and `module.json5`
configuration errors that block a build. You fix the error only — you do
not restructure module architecture, migrate V1 state management to V2, or
change routing patterns beyond what the error demands (those are the review
lens's concern in `language-code-review-edho-ferdian/references/arkts.md`).

Unlike most other stacks in this ecosystem, no separate build-fix source
covers HarmonyOS in one unified place spanning both review and build
validation. This file assembles a "Validate" workflow and build commands
into the diagnostic-table format this skill's other reference files use;
the error-cause-fix tables below beyond the direct command list are
synthesized from standard hvigor/ArkTS toolchain behavior in the same
spirit as this skill's `kotlin.md`/`rust.md` diagnostic tables, not copied
verbatim from any single source — no existing source names the validation
commands together with a build-fix diagnostic table.

## Diagnostic commands

Run these in order to localize the error before touching anything:

```bash
# Confirm toolchain
hvigorw --version
ohpm -v

# Full HAP package build (global hvigor environment) — the authoritative
# ArkTS compile check
hvigorw assembleHap -p product=default

# Build a specific module only, to isolate which module fails in a
# multi-module project
hvigorw assembleHap -p module=entry -p product=default

# Clean build — rules out stale incremental-build state before trusting
# an error as reproducible
hvigorw clean
hvigorw assembleHap -p product=default

# Run the unit/instrument test suite (surfaces different failures than a
# plain build — e.g. a test-only dependency gap)
hvigorw testHap -p product=default

# Dependency install/update — run when the error is dependency-resolution-
# shaped rather than a compile error
ohpm install
ohpm update
```

## Resolution workflow

```
1. Reproduce the error            -> capture the FULL hvigor/ArkTS compiler
                                      diagnostic, unedited (ArkTS's compiler
                                      routinely names the exact constraint
                                      violated and the file/line; read the
                                      full message before guessing at a fix)
2. Identify the error family      -> use the tables below
3. Read the affected file(s)      -> understand the surrounding component/
                                      module/dependency context before
                                      editing — don't fix a syntax error by
                                      guessing at nearby-looking valid syntax
4. Apply the minimal fix          -> only what the error demands
5. hvigorw assembleHap            -> confirm the specific error is gone
6. hvigorw testHap -p product=default -> confirm nothing else broke
```

**Read the ArkTS/hvigor diagnostic's own message fully.** ArkTS's compiler
diagnostics state the exact syntax constraint violated (it is a strict
TypeScript subset — see the constraint list below) or the exact missing
`actual`/permission/dependency; the fix is usually already spelled out in
the error text.

## ArkTS syntax-constraint compile errors

ArkTS is a strict, statically-typed subset of TypeScript. These are **hard
compile errors**, not lint warnings — the build fails outright.

| Error class | Cause | Fix |
|---|---|---|
| `any`/`unknown` type used | ArkTS disallows both — every value needs an explicit, statically-known type | Replace with the actual concrete type, an interface, or a class; if the value is genuinely heterogeneous JSON at a boundary, model it with a typed interface before use rather than typing it `any` |
| Destructuring assignment/declaration or destructured parameters | ArkTS disallows all destructuring | Use intermediate variables and field-by-field access (`const name = user.name` instead of `const { name } = user`); for parameters, accept the object and access fields inside the function body |
| `obj["field"]` dynamic property access | ArkTS disallows index-style property access | Use `obj.field` directly; if the field name is genuinely dynamic at runtime, the type needs restructuring (e.g. a `Map<string, T>` instead of a plain object) |
| `delete obj.field` | ArkTS disallows the `delete` operator | Model the field as a nullable type and assign `null` to mark absence, rather than removing the property |
| `var` declaration | ArkTS disallows `var` entirely | Use `let` (or `const` where the binding is never reassigned) |
| `for...in` loop | ArkTS disallows `for...in` | Use a regular indexed `for` loop, or `for...of` over `.keys()`/`.entries()` where the target is a `Map`/array |
| Function expression (`const f = function() {}`) | ArkTS disallows function expressions | Use an arrow function (`const f = () => {}`) |
| Nested function declaration inside another function | ArkTS disallows nested functions | Use a lambda/arrow function bound to a local `const` instead |
| `Function.apply`/`.call`/`.bind` | ArkTS disallows all three | Restructure to call the method directly on its owning instance, or pass an arrow function that closes over the needed context instead of rebinding `this` |
| Class field declared inside the constructor body | ArkTS requires fields declared at class-body level | Move the field declaration to the class body; initialize it in the constructor if needed, but the declaration itself must be outside `constructor()` |
| `as const` assertion | ArkTS disallows `as const` | Declare an explicit, named type (interface or class) instead of relying on literal-type inference |
| Index signature (`[key: string]: T`) on an interface/type | ArkTS disallows index signatures | Use `Record<K, V>` (one of the few TS utility types ArkTS supports) or restructure to an array/`Map` |
| Object literal for a class with methods, a parameterized constructor, or `readonly` fields | ArkTS only supports object-literal syntax when the compiler can infer a plain data shape | Use `new ClassName(...)` explicitly instead of an object-literal shorthand |

```bash
# Full recompile after fixing a syntax-constraint error — these are almost
# always caught immediately on the next build, no partial/incremental
# false negatives to worry about
hvigorw assembleHap -p product=default
```

## hvigor / OHPM dependency resolution errors

| Error | Cause | Fix |
|---|---|---|
| Module resolution failure referencing a package in `oh-package.json5` | The declared dependency doesn't exist at that version on the OHPM registry, or `oh-package.json5` and the actual `ohpm install`ed state have drifted | Verify the exact package name/version on the ohpm registry; run `ohpm install` to resync, then re-run the build |
| `HAR`/`HSP` module not found at build time despite being listed in `oh-package.json5` | A local inter-module dependency (`"dependencies": { "moduleName": "file:../moduleName" }`) points at a path that doesn't build cleanly on its own, or the referenced module wasn't itself built first | Build the referenced local module independently first (`hvigorw assembleHar` / `assembleHsp` for that module), confirm its own output artifact exists, then rebuild the dependent module |
| Version conflict between two dependencies requiring different versions of a shared transitive OHPM package | Two declared dependencies pull in incompatible versions of the same underlying package | Pin the shared package to one version explicitly in the top-level `oh-package.json5`, the same way a JS/npm project resolves a transitive version conflict via an override |
| `ohpm install` fails outright (network/registry error) | OHPM registry unreachable, or `.ohpmrc`/registry config pointing at an unavailable mirror | Confirm network access to the configured OHPM registry; check `.ohpmrc` for a stale/incorrect registry URL |

```bash
ohpm install
ohpm update
```

## module.json5 configuration errors

| Error | Cause | Fix |
|---|---|---|
| Build succeeds but the app crashes/refuses a system API call at runtime with a permission-denied error | The API's required permission isn't declared in `module.json5`'s `requestPermissions` | Add the permission entry (`name`, `reason` resource string, `usedScene`) per `rules/arkts/security.md`'s permission-declaration pattern; this is a config gap, not a code bug, even though it only surfaces at runtime |
| `Ability` referenced by a route/entry point not found at launch | The `Ability`'s class isn't correctly declared in `module.json5`'s `abilities` array, or the class name/path doesn't match the actual `.ets` file | Confirm the `abilities` entry's `name`/`srcEntry` matches the actual ability class location exactly |
| Build-profile API level mismatch | Code uses an API only available at a higher `compileSdkVersion`/`compatibleSdkVersion` than declared in `build-profile.json5` | Either raise the declared SDK level (checking device-target compatibility first) or avoid the newer API if the project must support older devices |

```bash
# No dedicated CLI validator for module.json5 semantics beyond the build
# itself — a malformed or incomplete module.json5 typically surfaces as
# either a build failure or a runtime permission/ability-not-found error
hvigorw assembleHap -p product=default
```

## Anti-suppression reminders specific to this stack

- Never type a value `any`/`unknown` (or otherwise route around an ArkTS
  type-system constraint) purely to silence a compile error — ArkTS
  disallows both types entirely, so this doesn't even compile; if you find
  yourself reaching for it, the actual fix is a proper interface/class, not
  a suppression, because there is no suppression available.
- Never delete or comment out a permission check / `requestPermissionsFromUser`
  call to make a runtime permission error stop appearing during local
  testing — that reintroduces the exact permission-denial crash for real
  users; fix the `module.json5` declaration and the runtime request flow
  instead.
- Never migrate a V1-decorated component to V2 (or vice versa) as a side
  effect of chasing an unrelated build error — a V1/V2 migration is a
  review-lens-scoped, deliberate change
  (`language-code-review-edho-ferdian/references/arkts.md`), not something
  to fold into a build fix incidentally.
- Never pin an OHPM dependency to an older version purely to dodge a
  version-conflict error without checking whether the newer version fixed a
  real bug or security issue the project needs — flag the conflict and the
  reasoning to the user rather than silently downgrading.
- Never remove a local `HAR`/`HSP` module dependency from `oh-package.json5`
  to make a build pass when the actual root cause is that the referenced
  module needs to be built first — removing the dependency declaration
  silently changes what the consuming module ships.

---

## Provenance

Diagnostic tables beyond the direct command list and constraint list
(dependency-resolution and `module.json5` error tables) are synthesized
from standard hvigor/OHPM/ArkTS toolchain behavior in the same spirit as
this skill's `kotlin.md`/`rust.md`/`go.md` diagnostic tables, not copied
verbatim from any single source.
