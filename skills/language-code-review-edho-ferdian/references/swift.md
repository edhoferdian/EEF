# Language Lens — Swift / Apple

Adapted from ECC `swiftui-patterns`, `swift-concurrency-6-2`,
`swift-actor-persistence`, and `swift-protocol-di-testing` (skills), plus
`agents/swift-reviewer.md` and `rules/swift/*.md`, fetched 2026-09-07.

**FOLD-M.** Kelompok lanjutan (34-item DEFER backlog): konten sedang,
plausibel dari sumber ECC, tapi **belum ada bukti proyek Swift/iOS/macOS
aktif** di workspace Edho saat ini — beda dari lens Python/React (FOLD-P)
yang sudah dipakai pada proyek nyata di ekosistem ini. Ini juga satu-satunya
lens dengan penghalang lingkungan tambahan: Edho berjalan di Windows 10, dan
toolchain Swift sendiri tidak bisa dijalankan di sana — jadi verifikasi
ground-truth (`swift build`, `swiftlint`) untuk lens ini secara struktural
tidak mungkin dilakukan oleh Edho sendiri, bukan sekadar belum dilakukan.
Perlakukan file ini sebagai lens siap-pakai begitu proyek Swift muncul (di
mesin manapun yang punya toolchain-nya, mis. CI macOS atau kontributor lain),
bukan sebagai sesuatu yang sudah tervalidasi lapangan.

**Detect.** A `Package.swift` at repo root, an `.xcodeproj`/`.xcworkspace`
directory, or any `.swift` file in review scope.

**Boundary — read before flagging anything.** Generic injection, generic
secret handling, generic function-length/nesting/magic-number checks, and
generic N+1 detection are **already owned by `references/review-checklist.md`**
in the general skill. This lens adds only what is specific to **Swift's
value-semantics/ARC model, protocol-oriented design, Swift Concurrency
(actors, `Sendable`, Swift 6.2 Approachable Concurrency), and SwiftUI's
`@Observable` state model** — patterns that compile cleanly but are still
bad design, plus idioms specific to persistence and testability on Apple
platforms.

**Code placement.** Findings land as **CQ-13 (Swift/Apple idiom
anti-patterns)** in the general report, except memory-safety-adjacent and
secret-handling items which are genuine SEC concerns — those go to SEC-08 in
the general report (or `security-review-edho-ferdian/references/
language-specific.md` once that file adds a dedicated Swift section; until
then, flag them here since force-unwrap-on-untrusted-input and
UserDefaults-for-secrets are memory/data-exposure risks the general skill
has no other lens for yet).

---

## Ground-truth commands

```bash
swift build                              # compile check
swift build -Xswiftc -strict-concurrency=complete   # Swift 6 strict concurrency check
swiftlint lint --quiet                   # idiom/style findings — most MEDIUM items below
swift test                               # confirms behavior, not design quality
swift package resolve                    # dependency graph sanity
xcodebuild -scheme <Scheme> -destination 'generic/platform=iOS Simulator' build  # Xcode-project builds
```

Do not label a `swiftlint`-detectable finding (force unwrap, `var` where
`let` suffices, missing access control) as [High confidence] without having
actually run `swiftlint lint`, and do not label a concurrency finding as
[High confidence] without having run `swift build` with strict concurrency
checking enabled — recognizing the pattern by eye is reasoning, not
verification, per the general skill's Phase 2 rule. **This lens is the one
case in the whole ecosystem where the tool itself may be unreachable** (no
macOS/Xcode/Swift toolchain on Edho's own Windows machine) — when that's
true, say so explicitly and cap every finding at [Medium confidence] with
the exact command that would confirm it, rather than silently treating
unreachable as unnecessary.

---

## Lens criteria

### CRITICAL — Safety

- **Force unwrapping (`value!`) in a production code path** — crashes the
  whole process on `nil` instead of handling the absence explicitly. Use
  `guard let`, `if let`, or `??`. **CQ-13.**
- **Force try (`try!`) without a comment proving the call can never throw
  at that site** — same crash-on-failure risk as force unwrap, for the
  error-throwing case. **CQ-13.**
- **Force cast (`as!`) without a preceding type check** — use `as?` with
  conditional binding; an unjustified force cast crashes on any input the
  author didn't anticipate. **CQ-13.**
- **Hardcoded secrets (API keys, tokens, passwords) in source** — Swift
  source ships inside the compiled binary and is trivially recoverable by
  decompilation; use Keychain Services or `ProcessInfo.processInfo.
  environment` / `.xcconfig` build-time injection instead. **SEC-08.**
- **Sensitive data stored in `UserDefaults`** — `UserDefaults` is an
  unencrypted plist on disk; anything security-sensitive (tokens,
  credentials, PII) belongs in Keychain Services. **SEC-08.**
- **App Transport Security (ATS) exceptions without a documented,
  narrowly-scoped justification** — an `NSAllowsArbitraryLoads` (or
  per-domain equivalent) entry in `Info.plist` disables TLS enforcement;
  flag any exception wider than the single domain that genuinely needs it.
  **SEC-08.**
- **Insecure deserialization of untrusted data** — `Decodable` decoding of
  external input without size limits or schema validation can be an
  amplification/DoS vector; flag decoding of network/user-supplied payloads
  with no bound. **SEC-08.**

### CRITICAL — Error handling

- **Silenced errors** — an empty `catch {}` block, or `try?` discarding an
  error that the caller actually needed to react to. **CQ-13.**
- **`fatalError()` used for a recoverable condition** — reserve
  `fatalError()` for genuinely unrecoverable programmer errors (an
  invariant that can only be violated by a bug); anything a caller could
  reasonably handle should `throw` instead. **CQ-13.**
- **`precondition`/`assert` confusion** — `assert` is stripped from release
  builds (debug-only), so using it for a check that must hold in production
  silently disables the check; `precondition` crashes in both debug and
  release, so using it inside library code a consumer might call with bad
  input turns a recoverable error into a forced crash. Match the tool to
  whether the check must survive release and whether the caller can handle
  failure. **CQ-13.**

### HIGH — Concurrency (Swift Concurrency / Swift 6.2)

- **Mutable shared state with no actor isolation or synchronization** — a
  class holding mutable state that's accessed from more than one
  concurrency domain without being an `actor` or otherwise synchronized is
  a live data race, whether or not the compiler currently catches it under
  the project's concurrency-checking mode. **CQ-13.**
- **A `Sendable`-violating type crossing an isolation boundary** — passing
  a non-`Sendable` reference type into an `actor` or across a `Task`
  boundary. Verify with `swift build -Xswiftc -strict-concurrency=complete`
  before flagging as High — under minimal/targeted concurrency checking
  (the pre-Swift-6 default) this often compiles silently. **CQ-13.**
- **`nonisolated` used to suppress a compiler concurrency error without a
  comment establishing why the access is actually safe** — `nonisolated`
  is a legitimate escape hatch for genuinely isolation-independent code,
  but reaching for it purely to silence the compiler defeats the point of
  actor isolation. **CQ-13.**
- **`@unchecked Sendable` without a documented, verified thread-safety
  argument** — this conformance is a promise to the compiler that the type
  is safe despite not being provably so; an unjustified `@unchecked
  Sendable` is functionally the same risk class as an unjustified `unsafe`
  block in Rust — the compiler's guarantee is void without the reviewer
  independently confirming the invariant. **CQ-13.**
- **Blocking work on `@MainActor`** — synchronous file/network I/O, or
  `Thread.sleep`, inside a `@MainActor`-isolated function freezes the UI;
  use `Task.sleep(for:)` and async I/O, or `@concurrent` (Swift 6.2) to
  explicitly offload to a background thread. **CQ-13.**
- **Unstructured `Task { }` with no cancellation handling** — a fire-and-
  forget task that outlives the view/object that spawned it leaks work and
  can mutate state after the owner is gone; prefer `.task { }` (SwiftUI,
  auto-cancels on view disappearance) or structured concurrency (`async
  let`, `TaskGroup`) that ties the task's lifetime to a scope. **CQ-13.**
- **`@concurrent` (Swift 6.2) applied to a function with no profiling
  evidence it needs background execution** — Swift 6.2's default is
  single-threaded/stays-on-calling-actor specifically so that concurrency
  is an intentional, profiled decision; scattering `@concurrent` across
  routine async functions reintroduces the implicit-offload data-race class
  Swift 6.2 was designed to eliminate. **CQ-13.** (adapted from ECC
  `swift-concurrency-6-2`, fetched 2026-09-07)
- **Actor reentrancy assumed away** — code inside an actor method that
  assumes its own state is unchanged across an `await` suspension point,
  when another call to the same actor could have run and mutated that
  state during the suspension. Re-check state after every `await` inside an
  actor method rather than trusting pre-suspension values. **CQ-13.**

### HIGH — Memory management (ARC)

- **A closure capturing `self` strongly in a long-lived context** (a stored
  closure property, a `NotificationCenter` observer, a timer callback) —
  creates a retain cycle if the owner also holds the closure; use `[weak
  self]` (or `[unowned self]` only when the closure's lifetime is provably
  shorter than `self`'s). **CQ-13.**
- **A delegate property declared without `weak`** — the classic
  `delegate: SomeDelegate` (not `weak var delegate:`) retain cycle between
  a view controller and its delegate. **CQ-13.**
- **An `@escaping` closure parameter with no explicit capture list** where
  it captures `self` or another reference type — forces the reviewer (and
  the compiler, pre-Swift-6) to reason about capture semantics implicitly;
  an explicit capture list states the intent. **CQ-13.**

### HIGH — Protocol-oriented design & SwiftUI state

- **Class inheritance chosen where protocol conformance with default
  extensions would suffice** — Swift's idiom favors composition via
  protocols over classical inheritance; flag a class hierarchy whose only
  purpose is sharing default behavior, not shared mutable identity.
  **CQ-13.**
- **`Any`/`AnyObject` used where a constrained generic or `any
  Protocol`/`some Protocol` would preserve type safety** — erases
  compile-time guarantees the language otherwise gives for free.
  **CQ-13.**
- **A type that should conform to `Equatable`/`Hashable`/`Codable`/
  `Sendable` but doesn't** — e.g. a `SwiftUI` view's data model missing
  `Equatable`, blocking the `Equatable`-conformance render-skip
  optimization the general skill's PERF domain would otherwise flag as
  available and unused. **CQ-13.**
- **`ObservableObject`/`@Published`/`@StateObject`/`@EnvironmentObject` used
  in new code instead of `@Observable`/`@State`/`@Environment`/`@Bindable`**
  — the pre-Observation-framework API still compiles and works, but
  `@Observable` gives property-level change tracking (only views reading
  the changed property re-render) that `ObservableObject` cannot; flag new
  code written against the older API as a missed-idiom finding, not a
  defect, unless the project is pinned to an OS deployment target below
  iOS 17/macOS 14 where `@Observable` isn't available (check the deployment
  target before flagging — this is a real false-positive trap). **CQ-13.**
  (adapted from ECC `swiftui-patterns`, fetched 2026-09-07)
- **`AnyView` type erasure used for a conditional view** where
  `@ViewBuilder` or `Group` would preserve the concrete view type — `AnyView`
  defeats SwiftUI's diffing and forces a full re-render of the erased
  subtree on every state change. **CQ-13.**
- **Async work (network calls, heavy computation) performed directly
  inside a SwiftUI `body` or a view's `init`** — `body` can be recomputed
  many times per second during animation; I/O or heavy work there is both
  a correctness and a performance bug. Use `.task { }` for load-on-appear
  work instead. **CQ-13/PERF.**
- **`ForEach` keyed by array index instead of a stable, unique identifier**
  — index-based IDs corrupt list state (selection, animation, `@State`
  inside row views) whenever the array is reordered, inserted into, or
  filtered; use `Identifiable` conformance or an explicit stable `id:.`
  **CQ-13.**

### HIGH — Persistence & testability (actor-based repositories, DI)

- **`DispatchQueue`/`NSLock`-based manual synchronization in new
  persistence code instead of an `actor`** — actors give compiler-enforced
  serialized access; a hand-rolled lock around a cache dictionary is strictly
  more error-prone for the same guarantee Swift now provides for free.
  **CQ-13.** (adapted from ECC `swift-actor-persistence`, fetched
  2026-09-07)
- **An actor-based repository exposing its internal cache/dictionary to
  external callers** instead of a minimal domain-operation API (`save`,
  `find`, `loadAll`) — leaks the storage implementation and lets callers
  bypass the actor's serialization guarantee by holding a direct reference
  to mutable internal state. **CQ-13.**
- **File writes without `.atomic`** in a persistence layer — a non-atomic
  write left mid-flight by a crash or termination corrupts the stored file;
  flag any `Data.write(to:)` in a repository/persistence type that omits
  `options: .atomic`. **CQ-13.**
- **A type touching file system/network/external APIs with no protocol
  seam for testing** — code that calls `FileManager.default`,
  `URLSession.shared`, or another concrete external dependency directly,
  with no `...Providing` protocol behind it, cannot be tested against
  failure paths (disk full, network error, corrupt data) without hitting
  the real dependency. Flag when the surrounding code clearly needs error-
  path test coverage and has none. **CQ-13.** (adapted from ECC
  `swift-protocol-di-testing`, fetched 2026-09-07)
- **A single "god protocol" covering multiple unrelated external
  concerns** (file access + network + bookmark storage all in one
  protocol) instead of small, single-responsibility protocols — makes
  mocking all-or-nothing and violates the same interface-segregation
  principle the general skill already expects elsewhere. **CQ-13.**
- **A protocol crossing actor boundaries without `Sendable` conformance**
  — a DI-seam protocol (`FileAccessorProviding`, etc.) used from inside an
  `actor` must itself be `Sendable`, or every conforming type becomes a
  potential data-race surface. **CQ-13.**

### MEDIUM — Performance & best practice

- **Allocation inside a tight loop** — creating objects/collections inside
  a loop that runs per-frame or per-row instead of hoisting the allocation
  out. **CQ-13.**
- **Growing an array without `reserveCapacity`** when the final size is
  known ahead of time. **CQ-13.**
- **String interpolation/concatenation inside a loop** instead of
  `append`/preallocated capacity. **CQ-13.**
- **`var` where `let` would suffice** — prefer immutable bindings by
  default; a `var` that's never reassigned is a missed-idiom finding.
  **CQ-13.**
- **`class` used for a pure data model where `struct` would suffice** —
  Swift's value-semantics default avoids a whole class of aliasing bugs;
  flag reference-type data models with no genuine identity/sharing
  requirement. **CQ-13.**
- **`print()` left in production code** instead of `os.Logger` or another
  structured logging facility. **CQ-13.**
- **Missing access control** — types/members defaulting to `internal` when
  `private`/`fileprivate` better reflects actual usage, widening the API
  surface unnecessarily within the module. **CQ-13.**
- **Wildcard `default:` on a `switch` over an app-owned, evolving enum**
  instead of `@unknown default` — silently absorbs new cases the compiler
  would otherwise force every call site to handle explicitly, the same
  latent-bug shape as Rust's wildcard-match finding in `references/rust.md`.
  **CQ-13.**

---

## Testing lens (Swift Testing + protocol-based mocking)

- **`XCTest`-style tests in new code where `Testing` (`@Test`, `#expect`,
  `#require`) would be idiomatic** for Swift 5.9+/6 projects — not a defect
  in an existing `XCTest` suite, but flag new test files reaching for the
  older framework without reason.
- **Mocks built by hand for concerns without a protocol seam** — if the
  code under test calls a concrete `FileManager`/`URLSession` directly, the
  fix is the protocol-DI pattern above, not a more elaborate mock of the
  concrete type (subclassing `URLProtocol`, swizzling, etc.).
- **A mock with no configurable error path** (`readError`, `writeError`
  properties on a mock, per the swift-protocol-di-testing pattern) —
  without it, the test suite can exercise the happy path only, and error-
  handling code (the CRITICAL "silenced errors" item above) ends up
  untested by construction.
- **`async` test functions not marked `async` / missing `await` on actor
  calls** — a common mechanical mistake when porting XCTest-era
  synchronous tests to actor-isolated production code; the compiler catches
  most of these, but a test using `Task { }` internally to dodge `async`
  hides the issue from the compiler too.
- **Coverage targets**: same as the general skill's Domain 5 (100%
  critical logic, 90%+ public API, 80%+ general) — nothing Swift-specific
  changes the targets, only the mocking mechanics to reach them.

---

## False-positive traps

- `!` (force unwrap) on an `IBOutlet` connected in Interface Builder/
  storyboard, or on a value that is provably non-`nil` at that point by a
  guard earlier in the same scope (state that proof before downgrading the
  finding) — a real but narrow exception, not a blanket pass for all force
  unwraps in UI code.
- `ObservableObject`/`@StateObject` in a project whose deployment target is
  below iOS 17/macOS 14 — `@Observable` isn't available there; check
  `IPHONEOS_DEPLOYMENT_TARGET`/`Package.swift` platforms before flagging
  this as a missed-idiom issue.
- `@unchecked Sendable` on a type that is genuinely immutable after `init`
  (all stored properties are `let`, and any reference-type property is
  itself deeply immutable) is a defensible, narrow use — verify the
  immutability claim before flagging as High.
- A wildcard `default:` on a `switch` over a *system-framework* enum (one
  Apple can add cases to without notice, e.g. many `UIKit`/system enums) is
  often the correct defensive choice — the `@unknown default` finding is
  about app-owned domain enums specifically.
- `try!`/force unwrap inside a `#Preview` block or test target is normal —
  previews and tests are expected to crash loudly on unexpected state, not
  demonstrate production error handling (same exception Rust's lens grants
  `.unwrap()` in `#[test]`).

## Escalate to general domain when…

- The finding is generic injection/secret-handling with no Swift-specific
  nuance — that's the general skill's SEC domain (or
  `security-review-edho-ferdian` directly for depth).
- The finding is about test coverage percentage rather than Swift-specific
  test mechanics — Domain 5 (`test-quality-lens.md`).
- A performance claim needs Instruments/Time Profiler evidence to confirm
  — escalate to `performance-audit-edho-ferdian` rather than asserting from
  code reading alone, and say plainly that Instruments cannot run on Edho's
  own Windows machine, same caveat as the ground-truth section above.

## Provenance

Adapted from ECC `swiftui-patterns`, `swift-concurrency-6-2`,
`swift-actor-persistence`, and `swift-protocol-di-testing` (all four are
`skills/*/SKILL.md` in the ECC tree), plus `agents/swift-reviewer.md`,
`rules/swift/security.md`, `rules/swift/patterns.md`, `rules/swift/
coding-style.md`, and `rules/swift/testing.md` — all fetched 2026-09-07 from
github.com/affaan-m/ECC. **FOLD-M** — see the status note at the top of this
file for what that means here, including the Windows-toolchain caveat that
is unique to this lens.
