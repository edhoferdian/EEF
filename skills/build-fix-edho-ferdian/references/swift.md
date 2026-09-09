# Swift/Apple — Xcode build, SPM & Swift 6 concurrency-checking lens

This lens draws on the Swift build-resolver material, plus
`swiftui-patterns`, `swift-concurrency-6-2`, `swift-actor-persistence`, and
`swift-protocol-di-testing` reference material for the concurrency/actor-isolation error
categories, and `rules/swift/*.md`.

**FOLD-M.** Konten sedang, plausibel, tapi **belum ada bukti
proyek Swift/iOS/macOS aktif** di workspace Edho saat ini — beda dari lens
JavaScript/TypeScript dan Django/Python (FOLD-P) yang sudah dipakai pada
proyek nyata di ekosistem ini. Swift juga punya penghalang tambahan yang
tidak dimiliki lens FOLD-M lain (Go, Rust): Edho berjalan di Windows 10, dan
`swift build`/`xcodebuild` **tidak bisa dijalankan sama sekali** di sana —
bukan sekadar "belum pernah dicoba". Perlakukan file ini sebagai diagnostic
lens siap-pakai untuk kapan pun ada mesin macOS (milik Edho, CI, atau
kontributor lain) yang menjalankan build Swift yang gagal — bukan sesuatu
yang sudah tervalidasi lapangan, dan catat secara eksplisit di setiap sesi
build-fix Swift bahwa verifikasi Phase 4 (re-run build) harus terjadi di
mesin yang benar-benar punya toolchain-nya.

Scope: `swift build`/`xcodebuild` failures — type-checker and protocol-
conformance errors, Swift Concurrency/`Sendable`/actor-isolation errors,
SPM (`Package.swift`/`Package.resolved`) dependency resolution failures,
and Xcode project configuration/code-signing failures. You fix the error
only — you do not restructure actor architecture or change public APIs
beyond what the error demands.

## Diagnostic commands

Run these in order to localize the error before touching anything:

```bash
# Confirm toolchain
swift --version
xcrun --find swift
grep 'swift-tools-version' Package.swift

# The actual build — capture the exact, unedited output
swift build 2>&1

# Swift 6 strict concurrency checking (the source of most Sendable/
# actor-isolation errors below — run explicitly if the project hasn't
# opted into Swift 6 language mode yet, to see what a future migration
# would surface)
swift build -Xswiftc -strict-concurrency=complete 2>&1

# Lint findings that are sometimes the actual root cause
if command -v swiftlint >/dev/null 2>&1; then swiftlint lint --quiet 2>&1; else echo "[info] swiftlint not installed - skipping lint"; fi

# Dependency graph state
swift package resolve 2>&1
swift package show-dependencies 2>&1
cat Package.resolved | head -40

# Confirm nothing else broke
swift test 2>&1
```

For Xcode projects specifically (`.xcodeproj`/`.xcworkspace`, not a bare
SPM package):

```bash
xcodebuild -list 2>&1
xcrun simctl list devices available 2>&1 | head -20
xcodebuild clean -scheme <Scheme>
xcodebuild -scheme <Scheme> -destination 'generic/platform=iOS Simulator' build 2>&1 | tail -50
xcodebuild -showBuildSettings 2>&1 | grep -E 'SWIFT_VERSION|CODE_SIGN|PRODUCT_BUNDLE_IDENTIFIER'
security find-identity -v -p codesigning
```

## Resolution workflow

```
1. Reproduce the error            -> capture the FULL swiftc/xcodebuild
                                      diagnostic, unedited
2. Identify the error family      -> use the tables below
3. Read the affected file         -> understand type/protocol/actor-
                                      isolation context before editing
4. Apply the minimal fix          -> only what the error demands
5. swift build                    -> confirm the specific error is gone
6. swiftlint lint (if installed)  -> check for warnings
7. swift build && swift test      -> confirm nothing else broke
```

## Type checker & protocol conformance errors

| Error | Cause | Fix |
|---|---|---|
| `cannot find type 'X' in scope` | Missing import, or a typo in the type name | Add `import Module`, or correct the name — check for a module that isn't linked in `Package.swift`/the target's frameworks |
| `value of type 'X' has no member 'Y'` | Wrong type at the call site, or a missing extension providing `Y` | Fix the type, or add the missing method/extension — read the actual declared type before guessing |
| `cannot convert value of type 'X' to expected type 'Y'` | Type mismatch at assignment/call | Add an explicit conversion or cast only if semantically valid; otherwise one side of the mismatch is simply wrong — identify which before "fixing" the wrong one |
| `type 'X' does not conform to protocol 'Y'` | Missing required protocol members, or a signature mismatch on an existing member | Implement exactly the missing requirements; check associated-type and default-implementation interactions before adding stubs |
| `missing return in closure expected to return 'X'` | A code path in the closure body doesn't return a value | Add the explicit return on the falling-through path |
| `initializer requires that 'X' conform to 'Decodable'` | Missing `Codable`/`Decodable` conformance on a type used with `JSONDecoder` or similar | Add the conformance (synthesized, if all properties are themselves `Codable`) or a custom `init(from:)` |
| `ambiguous use of 'X'` | Multiple matching declarations in scope (often two extensions, or an overload set) | Use a fully qualified name or an explicit type annotation to disambiguate |
| `circular reference` | A recursive `struct`/`enum` without indirection | Use `indirect enum`, or box the recursive member behind a reference type |
| `cannot assign to property: 'X' is a 'let' constant` | Attempting to mutate an immutable binding | Change to `var` only if mutation is genuinely intended; otherwise the code was relying on a mutation that shouldn't happen — read why before flipping `let`→`var` |

```bash
swift build 2>&1 | head -50   # narrow to the first error in a multi-error build
```

## Swift Concurrency / `Sendable` / actor-isolation errors

This category is the largest source of Swift 6 migration build failures —
read `swift-concurrency-6-2` (the review-lens counterpart to this file) for
the underlying model before treating these as one-off fixes.

| Error | Cause | Fix |
|---|---|---|
| `expression is 'async' but is not marked with 'await'` | Calling an `async` function without `await` | Add `await` at the call site — if the caller isn't itself `async`, propagate `async` up, don't wrap in a blocking bridge |
| `non-sendable type 'X' passed in implicitly asynchronous call` | A non-`Sendable` reference type crossing an actor/`Task` boundary | Make `X` `Sendable` (often by making it a `struct`, or marking stored properties `let`), or restructure so the value doesn't need to cross the boundary — **do not** reach for `@unchecked Sendable` without verifying thread safety first (see Anti-suppression below) |
| `actor-isolated property cannot be referenced from non-isolated context` | Accessing actor state from outside the actor without `await` | Add `await` and make the caller `async`; use `nonisolated` on the *specific member* only if it genuinely doesn't touch actor-protected state, never as a blanket fix |
| `reference to captured var 'X' in concurrently-executing code` | A closure captures a mutable variable that could be accessed from multiple tasks concurrently | Capture an immutable `let` copy before the closure, or move the mutable state behind an actor |
| `@MainActor function cannot be called from non-isolated context` | Calling MainActor-isolated code from a background/nonisolated context | Add `await` and make the caller `async` (it will hop to the main actor automatically), or wrap in `await MainActor.run { }` only when restructuring the caller isn't feasible |
| `Sending 'X' risks causing data races` | A value whose ownership is being transferred across an isolation boundary might still be referenced from the original context afterward | Confirm the value is not used again after the send, or restructure so it is genuinely handed off (this error is Swift 6.2's protection against exactly the implicit-offload bug class `swift-concurrency-6-2` documents — read that skill's "Core Problem" section before working around it) |
| `main actor-isolated conformance cannot be used here` | A `nonisolated` context trying to use a protocol conformance that's isolated to `@MainActor` (an "isolated conformance") | Either isolate the consuming context to `@MainActor` too if that's correct, or don't attempt to use a `@MainActor`-isolated conformance from genuinely isolation-independent code |
| `static property 'shared' is not concurrency-safe because it is not either conforming to 'Sendable' or isolated to a global actor` | A `static let shared = ...` singleton on a non-`Sendable`, non-isolated type | Mark the type `@MainActor` (if it's UI/app-state related) or make it genuinely `Sendable`, per the "Global and Static Variables" pattern in `swift-concurrency-6-2` |

```bash
swift build -Xswiftc -strict-concurrency=complete 2>&1   # surface every
                                                            # concurrency error under Swift 6 checking, even if the
                                                            # project hasn't switched to Swift 6 language mode yet
```

## SPM dependency resolution (`Package.swift` / `Package.resolved`)

| Error | Cause | Fix |
|---|---|---|
| `failed to resolve dependencies` / version conflict between packages | Two dependencies require incompatible version ranges of the same package | `swift package show-dependencies --format json` to see the full graph, then relax the tightest constraint (usually your own `Package.swift`, not a transitive dependency you don't control) |
| `the package dependency ... could not be resolved` | Wrong URL/branch/tag in `Package.swift`, or a private repo without access configured | Verify the exact URL and version requirement; confirm SSH/token access for private dependencies |
| `Package.resolved` out of sync / "please run swift package update" | `Package.swift` was edited without regenerating the resolved-versions lockfile | `swift package resolve` (targeted) rather than `swift package update` (which can bump every dependency at once — confirm with the user before a broad update) |
| `error: cyclic dependency declaration found` | Two local/path packages depend on each other | Break the cycle by extracting the shared code into a third package both depend on |
| `swift-tools-version` mismatch (`Package.swift` requires version X, toolchain has Y`) | The installed Swift toolchain is older than what `Package.swift` declares | Confirm with the user before lowering `swift-tools-version` — like a Rust `edition` bump, this is a project-wide compatibility decision, not a narrow build fix; the more common direction is the user's toolchain needing an upgrade instead |

```bash
swift package reset                        # clear local package caches
swift package resolve                      # re-resolve without bumping versions
swift package update <PackageName>         # bump ONE dependency's resolved version
swift package show-dependencies --format json
swift package dump-package                 # validates Package.swift parses correctly
```

## Xcode project / code-signing failures

| Error | Cause | Fix |
|---|---|---|
| `Signing for "X" requires a development team` | No team/provisioning profile selected for the target | This requires the user's Apple Developer account configuration — surface it and stop; not fixable from source alone |
| `No profiles for 'com.x.y' were found` | Missing or expired provisioning profile | User action required (Xcode → Signing & Capabilities, or a fresh profile download) — flag and stop, don't attempt automated workarounds |
| `Multiple commands produce ...` | Two build phases/targets both output the same file (common after a merge or a duplicated file reference) | Remove the duplicate build-phase membership or file reference in the project — read the `.pbxproj` or use Xcode's UI, don't guess which duplicate to delete without checking both |
| `Module 'X' not found` (Xcode build, not `swift build`) | Framework/module not linked in the target's "Link Binary With Libraries" build phase, or a missing `-F`/framework search path | Check `xcodebuild -showBuildSettings \| grep -E 'FRAMEWORK_SEARCH_PATHS\|OTHER_LDFLAGS'` and the target's linked frameworks list |
| `Command PhaseScriptExecution failed` | A custom Run Script build phase exited non-zero (SwiftLint/SwiftGen/a code-gen script) | Run the exact script command Xcode ran (visible in the full build log) locally to see its real error, then fix that underlying tool's failure, not the wrapper |

```bash
xcodebuild -showBuildSettings 2>&1 | grep -E 'SWIFT_VERSION|CODE_SIGN|PRODUCT_BUNDLE_IDENTIFIER'
security find-identity -v -p codesigning
xcodebuild -scheme <Scheme> build 2>&1 | grep -E 'module|framework|import'
```

## Anti-suppression reminders specific to this stack

- **Never use `@unchecked Sendable` to silence a concurrency error without
  independently verifying thread safety** — this is the Swift equivalent of
  Rust's unjustified `unsafe` block: it turns off the compiler's guarantee
  entirely and shifts the burden onto a claim nobody checked. If the type
  is genuinely safe (fully immutable after `init`, or internally
  synchronized), say so in a comment next to the conformance.
- **Never use force unwrap (`!`) or force try (`try!`) to make a type or
  concurrency error disappear** — handle the optional/error explicitly with
  `guard let`/`if let`/`do-catch`, per the review lens's CRITICAL section.
  This is a suppression, not a fix, and the Phase 5 Reflection gate should
  catch it before reporting success.
- **Never add `// swiftlint:disable` without explicit user approval** —
  same as any other blanket-suppression rule elsewhere in this ecosystem;
  a lint finding papered over this way survives every future review pass
  silently.
- **Never bump `swift-tools-version`, a package's major version, or a
  project's minimum deployment target to resolve a build error without
  flagging it to the user first** — each is an architectural/scope
  decision (same category as a Cargo `edition` bump or a Go module major
  bump elsewhere in this ecosystem), not a narrow build fix, even when it
  "just works."
- **Never treat a code-signing/provisioning failure as something to route
  around programmatically** — it requires the user's Apple Developer
  account state, not a source-code change; surface it and stop per the
  general skill's "Loop guard" rule on errors needing a decision only the
  user can make.
- **A build-fix session for this stack cannot itself confirm Phase 4
  ("Build Status: SUCCESS") on Edho's own Windows machine** — say so
  plainly in the Phase 6 report when this lens is used without an actual
  macOS/Xcode environment to re-run the build in, rather than reporting
  green on an assumption.
