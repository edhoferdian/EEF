# Language Lens — ArkTS / HarmonyOS

Adapted from ECC `harmonyos-app-resolver` and `rules/arkts/patterns.md` /
`rules/arkts/coding-style.md`, fetched 2026-09-09.

**FOLD-M.** Kelompok DEFER-backlog: konten padat, plausibel dari sumber ECC,
tapi **belum ada bukti proyek HarmonyOS/ArkTS aktif** di workspace Edho saat
ini — beda dari lens Python/React (FOLD-P) yang sudah dipakai pada proyek
nyata di ekosistem ini. File ini ditulis proaktif (gate "tunggu proyek
nyata" dicabut per keputusan pemilik ekosistem, closing the ArkTS/HarmonyOS
placeholder note in `build-fix-edho-ferdian/SKILL.md`), tapi perlakukan
sebagai lens siap-pakai begitu proyek HarmonyOS muncul, bukan sebagai
sesuatu yang sudah tervalidasi lapangan.

**Detect.** An `oh-package.json5` or `module.json5` at the project root, any
`.ets` file in review scope, or a `build-profile.json5` naming a HarmonyOS/
OpenHarmony API level/device target.

**Boundary — read before flagging anything.** Generic injection, generic
secret handling, generic function-length/nesting/magic-number checks, and
generic N+1 detection are **already owned by `references/review-checklist.md`**
in the general skill. This lens adds only what is specific to **ArkUI State
Management V2 compliance, Navigation-only routing, ArkTS's stricter-than-
TypeScript type-system constraints, and HarmonyOS API/architecture
conventions**. Unlike most other stacks in this ecosystem, ECC did not split
HarmonyOS coverage into separate resolver/reviewer agents — a single unified
`harmonyos-app-resolver` agent covers both review and implementation, so this
review lens and the sibling build-fix lens
(`build-fix-edho-ferdian/references/arkts.md`) are both adapted from that one
source plus the `rules/arkts/*` rule files.

**Code placement.** Findings land as **CQ-16 (ArkTS/HarmonyOS state-
management, routing, and API-usage anti-patterns)** in the general report.
**Security is a separate lens** — see
`security-review-edho-ferdian/references/language-specific.md`'s
`## ArkTS / HarmonyOS` section (SEC-08 cross-reference) for permission
declarations, secret handling, deep-link validation, and network/storage
security. Don't duplicate security findings into CQ-16.

---

## Ground-truth commands

```bash
hvigorw assembleHap -p product=default   # full HAP build — the authoritative
                                          # ArkTS compile check; run before
                                          # labeling any syntax-constraint
                                          # violation [High confidence]
hvigorw testHap -p product=default       # unit test run
ohpm install                             # dependency resolution
```

Do not label an ArkTS syntax-constraint violation (`any`/`unknown` usage,
destructuring, `var`, etc. — see below) as [High confidence] without having
actually run `hvigorw assembleHap` and observed the compiler reject it —
recognizing the pattern by eye is reasoning, not verification, per the
general skill's Phase 2 rule. Most of these *are* hard compile errors in
ArkTS (not lint warnings), so the build is the fastest way to confirm.

---

## Lens criteria

### CRITICAL

- **V1 state-management decorator used anywhere in a new or modified
  `.ets` file** — `@Component`, `@State`, `@Prop`, `@Link`, `@ObjectLink`,
  `@Observed`, `@Provide`, `@Consume`, or `@Watch`. ECC's
  `harmonyos-app-resolver` treats V2 as a hard, non-negotiable constraint
  ("MUST use ArkUI State Management V2 ... MUST NOT use V1 decorators") —
  not a style preference. The V2 equivalents: `@ComponentV2` (replaces
  `@Component`), `@Local` (replaces `@State`), `@Param` (replaces `@Prop`),
  `@Event` (replaces a callback prop pattern), `@Provider`/`@Consumer`
  (replace `@Provide`/`@Consume`), `@Monitor` (replaces `@Watch`), and
  `@ObservedV2` + `@Trace` (replace `@Observed` + `@State`/`@Link` on a
  model class). **CQ-16.**
- **`@ohos.router` (the legacy `router` module) used for page navigation**
  — the same hard constraint as above applies to routing: `Navigation` +
  `NavPathStack` is the only sanctioned mechanism. A `router.pushUrl(...)`/
  `router.back()` call, or an `import router from '@ohos.router'`, in new or
  modified code is a CRITICAL finding regardless of whether it "works" —
  migrate to `this.navPathStack.pushPath({...})` /
  `.replacePath({...})` / `.pop()` against a `NavPathStack` owned by the
  page's `Navigation` component. **CQ-16.**
- **A hard ArkTS syntax-constraint violation that will fail compilation** —
  ArkTS is a strict subset of TypeScript, and the following are compile
  errors, not style nits: `any`/`unknown` type usage, destructuring
  assignment or destructured parameters, `obj["field"]` dynamic property
  access, the `delete` operator, `var`, `for...in` loops, function
  expressions (non-arrow), nested functions, generator functions,
  `Function.apply`/`.call`/`.bind`, class fields declared in a constructor
  body, index signatures, and `as const` assertions. Flag any of these on
  sight — they are not a "consider fixing" suggestion, the build will
  reject them outright. Cross-check with `hvigorw assembleHap` before
  labeling [High confidence]. **CQ-16.**

### HIGH

- **A UI component whose observable model class is missing `@ObservedV2`
  on the class or `@Trace` on a property that the UI actually reads
  reactively** — under V2, only `@Trace`-marked properties on an
  `@ObservedV2` class trigger recomposition when mutated; a plain class
  property (or a class missing `@ObservedV2` entirely) silently fails to
  update the UI on change, with no compile error to catch it. This is the
  V2-era equivalent of forgetting `@Observed`/`@Link` in V1 code, and is
  easy to miss because the code still compiles and runs — it just doesn't
  re-render. **CQ-16.**
- **Business logic (network calls, validation, data transformation) placed
  directly inside a component's `build()` method or an inline `.onClick()`
  handler**, instead of delegated to a ViewModel — `harmonyos-app-resolver`'s
  recommended architecture is layered MVVM (`model/` `@ObservedV2` classes,
  `viewmodel/` business logic, `view/` `@ComponentV2` structs rendering
  only, `service/` for network/DB/file I/O); `build()` should contain only
  rendering logic. **CQ-16.**
- **Hardcoded UI string/color/dimension literal instead of a `$r()`
  resource reference** (`Text('Hello').fontSize(16).fontColor('#333333')`
  rather than `Text($r('app.string.greeting')).fontSize($r('app.float.
  font_size_body')).fontColor($r('app.color.text_primary'))`) — breaks
  i18n (the literal string can't be localized) and dark-theme support (the
  literal color can't respond to a theme-specific resource override).
  Flag any literal that a `$r()` resource would normally back — this is an
  explicit review-workflow check in the ECC source ("Verify resource
  references use `$r()` instead of hardcoded literals"). **CQ-16.**
- **`LazyForEach` missing on a `List`/`Grid` rendering a data source that
  can grow large**, with a plain `ForEach` used instead — `ForEach`
  eagerly renders every item; `LazyForEach` (with a stable per-item key via
  its third argument) renders only visible items and is the ECC source's
  explicit performance guidance for large lists. **CQ-16.**
- **An animation driven by repeatedly changing `width`/`height`/`padding`/
  `margin`** instead of `transform` (translate/scale/rotate) and `opacity`
  — `harmonyos-app-resolver` calls this out explicitly as a "severe
  performance impact" anti-pattern, since layout-affecting properties force
  a full re-layout pass on every animation frame while `transform`/
  `opacity` can be composited without re-layout. **CQ-16.**

### MEDIUM

- **New or modified i18n string resource added to only one language
  directory** — the ECC review workflow explicitly checks "i18n
  completeness across all language directories"; a string added to
  `en_US` but not the project's other supported locales silently falls
  back (or breaks) for those users. **CQ-16.**
- **New color resource with no corresponding dark-theme value** — flagged
  as a recommended check in the ECC source ("Check if new color resources
  need dark theme support"); not a hard requirement on every project, but
  worth surfacing when the project otherwise has dark-theme resource
  coverage elsewhere.
- **A component approaching 400+ lines with no extraction**, or a file
  nearing 800 lines — the ArkTS coding-style source's file-size guidance
  mirrors this ecosystem's general 400-typical/800-max convention, called
  out specifically for `.ets` component files where a single
  `@ComponentV2` struct tends to accumulate inline `build()` complexity.
- **`renderGroup(true)` missing on a complex sub-component tree that is
  itself being animated** — the ECC source recommends this to batch
  renders and reduce animation overhead for non-trivial nested component
  animations; flag only when the sub-tree is genuinely complex (multiple
  nested containers), not every animated leaf component.

---

## Architecture lens (MVVM layering)

`harmonyos-app-resolver`'s recommended module layout:

```
feature/
  |-- model/           # Data models (@ObservedV2 classes)
  |-- viewmodel/       # Business logic (ViewModel classes)
  |-- view/            # UI components (@ComponentV2 structs)
  |-- service/         # API calls, data access
```

- **View** — rendering only, no business logic in `build()`.
- **ViewModel** — all business logic encapsulated here; one ViewModel class
  per file (per the coding-style source's file-organization convention).
- **Model** — pure data classes with `@ObservedV2`/`@Trace`.
- **Service** — network requests, database operations, file I/O.

Flag a clear layering violation (a `service`-shaped network call issued
directly from a `view` component, a `model` class carrying business logic
methods beyond simple derived `@Computed` values) as **CQ-16**, same as any
other architecture-layering finding this ecosystem already flags for other
stacks — this is not a new finding category, just the ArkTS instance of it.

---

## False-positive traps

- A V1 decorator (`@State`, `@Component`, etc.) appearing only in
  **unmodified, pre-existing code outside the current review scope** is not
  a CQ-16 finding on its own — flag it only if the reviewed diff touches
  that component (per this ecosystem's general "don't flag unrelated
  pre-existing code" discipline), though a brief note that the file is
  still on V1 and due for migration is reasonable context to include.
- `any`/`unknown`-shaped code that is actually TypeScript in a `.ts` file
  **outside** the ArkTS-compiled `.ets` component tree (e.g. a Node-side
  build script, a shared non-UI utility module not compiled by `hvigorw`)
  is not subject to ArkTS's stricter type-system constraints — confirm the
  file is actually part of the ArkTS compilation unit before flagging a
  type-system violation.
- A hardcoded literal inside test code (`ohosTest/`) or a one-off debug
  string is not a `$r()` finding — the resource-reference requirement is
  about user-facing production UI strings/colors/dimensions.
- `ForEach` (not `LazyForEach`) over a small, bounded, rarely-changing list
  (a fixed set of navigation tabs, a settings menu with a handful of
  entries) is fine — the `LazyForEach` finding is about lists that can grow
  large or are backed by a paginated/dynamic data source, not every list in
  the app.

## Escalate to general domain when…

- The finding is generic injection/secret-handling with no ArkTS-specific
  nuance — that's `security-review-edho-ferdian/references/
  language-specific.md`'s `## ArkTS / HarmonyOS` section, not this lens.
- The finding is about test coverage percentage rather than ArkTS-specific
  test mechanics (Hypium/`@ohos.UiTest` usage, `NavPathStack`
  push/pop/replace test coverage, `@Trace` reactivity verification) —
  Domain 5 (`test-quality-lens.md`) for the percentage, this file's own
  guidance (sourced from `rules/arkts/testing.md`) for the mechanics.
- A performance claim about render-batch overhead or animation frame cost
  needs profiling/benchmark evidence to confirm — escalate to
  `performance-audit-edho-ferdian` rather than asserting from code reading
  alone.
- The build itself is failing (ArkTS syntax-constraint violation, hvigor
  configuration error, dependency resolution failure) rather than a
  compiling-but-suboptimal pattern — that's
  `build-fix-edho-ferdian/references/arkts.md`, not this review lens.

---

## Provenance

Adapted from ECC `harmonyos-app-resolver` and `rules/arkts/*`, fetched
2026-09-09 (github.com/affaan-m/ECC, paths
`agents/harmonyos-app-resolver.md`, `rules/arkts/coding-style.md`,
`rules/arkts/patterns.md`).
