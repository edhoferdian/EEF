# Swift Authoring — modern Swift, written well

Use when you write new Swift, move code to Swift 6, or chase a race, a
deadlock, a leak or a slow path in Swift. Reviewing Swift belongs to
`language-code-review-edho-ferdian` (`references/swift.md`); build errors
to `build-fix-edho-ferdian`.

**First, find out what you're working with.** Swift changes fast and agents
tend to write the Swift of a few years ago.

- Toolchain: `swift --version`; Xcode version.
- Language mode: `swiftLanguageModes` / `swift-tools-version` in
  `Package.swift`, or the "Swift Language Version" build setting. Swift 5
  mode warns about data races; Swift 6 mode makes them errors.
- Concurrency settings: "Default Actor Isolation" (MainActor or
  nonisolated), "Approachable Concurrency" / upcoming features such as
  `NonisolatedNonsendingByDefault`, `InferIsolatedConformances`.
- Deployment targets: newer APIs (`Mutex`, Observation, Swift Testing,
  `@concurrent`) need recent OS versions or toolchains.

Look up anything version-specific (Context7, swift.org evolution
proposals) instead of guessing.

---

## 1. Modelling data

**Value types first.** `struct` and `enum` for data; they copy on
assignment, are thread-safe to share when immutable, and become
`Sendable` automatically (non-public, all-Sendable members).

Reach for `class` only for identity (two references to one thing), shared
mutable state with a lifecycle, inheritance required by a framework, or
Objective-C interop. Reach for `actor` when that shared mutable state is
accessed concurrently.

**Make illegal states unrepresentable.**

```swift
// Before: four flags and optionals that can contradict each other.
struct Download { var isLoading: Bool; var progress: Double?; var file: URL?; var error: Error? }

// After: exactly one state at a time.
enum DownloadState {
  case idle
  case loading(progress: Double)
  case finished(URL)
  case failed(DownloadError)
}
```

**Small, typed wrappers** stop mixing up IDs and units:

```swift
struct UserID: Hashable, Codable, Sendable { let rawValue: UUID }
struct Meters: Comparable, Sendable { var value: Double }
```

**Defaults:** `let` over `var`; narrowest access level (`private` →
`fileprivate` → `internal` → `package` → `public`); `final` on classes not
designed for subclassing (also enables static dispatch).

**Synthesised conformances.** Let the compiler write `Equatable`,
`Hashable`, `Codable`, `Comparable` (enums), `Sendable`. Write them by hand
only when the semantics differ, and then test them.

**Codable.** Use `CodingKeys` for renamed fields, custom `init(from:)` only
for real transformations; decode dates with an explicit strategy; prefer
optional fields or defaults over failing the whole payload when the server
may omit a field.

## 2. Observation and SwiftUI state

New models use the Observation framework:

```swift
import Observation

@Observable
final class CartModel {
  var items: [Item] = []
  var total: Decimal { items.reduce(0) { $0 + $1.price } }  // views re-render only on what they read
  @ObservationIgnored var cache: [ItemID: Image] = [:]
}
```

- SwiftUI ownership: `@State` for a model the view creates and owns;
  plain property for one passed in; `@Bindable` to get bindings;
  `@Environment(Model.self)` for injected models.
- `ObservableObject` + `@Published` + `@StateObject` only in code that
  must support older OS versions.
- Keep views small; extract subviews instead of computed `some View`
  properties so SwiftUI can diff them independently.
- Side effects belong in `.task { }` (cancelled automatically when the
  view disappears), not in `onAppear` + `Task { }`.

## 3. Concurrency — Swift 6 data-race safety

### Isolation in one paragraph

Every piece of mutable state is protected by an isolation domain: the main
actor, a custom actor, or a single task. The compiler checks that values
crossing between domains are safe (`Sendable`) and that state is touched
only from its domain. Errors are the compiler finding a real or possible
race — fix the design, don't silence the checker.

### Sendable

- Structs/enums of Sendable members: Sendable (implicitly if non-public,
  declare it if public).
- Final classes with only immutable (`let`) Sendable properties: can
  conform to `Sendable`.
- Mutable classes shared across tasks: make them actors, isolate them to
  `@MainActor`, or protect state with `Mutex`.
- **`@unchecked Sendable` is a promise the compiler can't check.** Use it
  only when the type has real internal synchronisation, and say so:

```swift
import Synchronization

final class Counter: Sendable {
  private let value = Mutex(0)
  func increment() -> Int { value.withLock { $0 += 1; return $0 } }
}
```

`Mutex` (Synchronization module) is Sendable itself, so no `@unchecked`
is needed here.

- **`sending`** parameters/results transfer ownership of a non-Sendable
  value into another domain; the caller can't touch it afterwards.

### Mutable globals and statics

They trip the checker most often. Fix in this order of preference:

1. Make it a `let` of a Sendable type.
2. Isolate it: `@MainActor static var shared = …`.
3. Protect it: `static let cache = Mutex<[Key: Value]>([:])`.
4. Last resort, with a comment explaining why it's safe:
   `nonisolated(unsafe) static var …`.

### Where code runs — know your project's settings

- With **MainActor default isolation** (common for app targets), every
  declaration is `@MainActor` unless marked otherwise. Most UI code then
  needs no annotations at all.
- With **nonisolated-nonsending by default** (approachable concurrency),
  a `nonisolated async` function runs on the caller's actor instead of
  hopping to the global executor. To deliberately move work off the
  caller's actor, mark the function `@concurrent`:

```swift
@concurrent
func decodeThumbnails(_ data: [Data]) async -> [CGImage] {
  // CPU-heavy work; runs on the concurrent pool, not the main actor
  data.compactMap(makeImage)
}
```

- Without these settings, older rules apply: `nonisolated async`
  functions always leave the caller's actor. Check before reasoning about
  hangs.

### Structured concurrency

```swift
// Fixed number of parallel children
async let profile = api.profile(id)
async let feed = api.feed(id)
let screen = try await Screen(profile: profile, feed: feed)

// Dynamic number — but bounded
func thumbnails(for urls: [URL], maxConcurrent: Int = 4) async throws -> [URL: Image] {
  try await withThrowingTaskGroup(of: (URL, Image).self) { group in
    var results: [URL: Image] = [:]
    var iterator = urls.makeIterator()
    for _ in 0..<maxConcurrent {
      if let url = iterator.next() { group.addTask { (url, try await load(url)) } }
    }
    while let (url, image) = try await group.next() {
      results[url] = image
      if let next = iterator.next() { group.addTask { (next, try await load(next)) } }
    }
    return results
  }
}
```

- Never spawn one child per element of an unbounded list — keep a window
  of N in flight.
- Prefer structured tasks; `Task { }` only to bridge from synchronous
  code (button actions), and keep the handle if it must be cancelled.
- `Task.detached` almost never — it drops priority and isolation context.
- Check cancellation in long loops: `try Task.checkCancellation()` or
  `if Task.isCancelled { break }`.
- Timeouts: race the work against `Task.sleep(for:)` in a task group and
  cancel the loser.

### Actors

```swift
actor ImageCache {
  private var store: [URL: Image] = [:]
  private var inFlight: [URL: Task<Image, Error>] = [:]

  func image(for url: URL) async throws -> Image {
    if let cached = store[url] { return cached }
    if let task = inFlight[url] { return try await task.value }  // dedupe concurrent requests
    let task = Task { try await download(url) }
    inFlight[url] = task
    defer { inFlight[url] = nil }
    let image = try await task.value
    store[url] = image
    return image
  }
}
```

- **Reentrancy:** state can change across every `await` inside an actor.
  Re-check invariants after suspension; the in-flight-task pattern above
  avoids duplicate work.
- Keep actor methods short and synchronous where possible; do heavy work
  outside and hand back results.
- Don't make everything an actor: one actor per independent piece of
  shared state.

### Bridging old APIs

```swift
// Callback → async
func location() async throws -> CLLocation {
  try await withCheckedThrowingContinuation { continuation in
    manager.requestLocation { result in continuation.resume(with: result) }  // resume exactly once
  }
}

// Delegate / notifications → AsyncStream
let (stream, continuation) = AsyncStream.makeStream(of: Event.self)
delegate.onEvent = { continuation.yield($0) }
continuation.onTermination = { _ in delegate.onEvent = nil }
for await event in stream { handle(event) }
```

### Hangs and deadlocks

- Never block a thread waiting for async work (`DispatchSemaphore.wait`,
  `DispatchGroup.wait`, `Thread.sleep` inside async code). The cooperative
  pool has a fixed number of threads; blocking them deadlocks.
- Heavy synchronous work on the main actor freezes the UI — move it to a
  `@concurrent` function or a background actor.
- `MainActor.run` hops are cheap but not free; batch UI updates.
- Use Instruments' Swift Concurrency and Hangs templates to see what is
  blocking.

## 4. Protocols and generics

- **`some` vs `any`:** `some Protocol` when there's one concrete type
  (static dispatch, full type information); `any Protocol` only for
  heterogeneous collections or when the type must be chosen at runtime.

```swift
func render(_ shape: some Shape) { … }          // generic, fast
let layers: [any Shape] = [Circle(), Rectangle()] // heterogeneous
```

- **Primary associated types:** `some Collection<Int>`,
  `any AsyncSequence<Event, Never>` instead of long where-clauses.
- Protocol extensions provide default behaviour; requirements that need
  dynamic dispatch must be declared in the protocol itself.
- Don't create a protocol for a single conformer "for testing" — inject a
  closure or a struct of closures instead when that's simpler.
- Parameter packs (`each T`) for APIs that take a variable number of
  generic values; rarely needed in app code.

## 5. API design

Follow the Swift API Design Guidelines:

- Clarity at the point of use beats brevity.
- Name by role, not type: `var greeting: String`, not `var string`.
- Argument labels read as English phrases: `move(from: a, to: b)`,
  `remove(at: index)`.
- Mutating/non-mutating pairs: `sort()` / `sorted()`,
  `append(_:)` / `appending(_:)`.
- Booleans read as assertions: `isEmpty`, `canUndo`, `hasChanges`.
- Factory methods start with `make`.
- Prefer methods and properties to free functions, except where there's
  no obvious `self`.
- Document public APIs with a summary line; describe complexity when it
  isn't O(1).

## 6. Errors

```swift
enum ParseError: Error, Equatable {
  case unexpectedToken(String, line: Int)
  case unterminatedString(line: Int)
}

func parse(_ source: String) throws(ParseError) -> AST { … }   // typed throws
```

- Specific error enums with context (what, where), not strings.
- Typed throws where callers benefit from exhaustive `catch` (internal
  modules, embedded, performance-sensitive paths); untyped `throws` is
  still the right default for public APIs that may grow new failures.
- `Result` only at boundaries that can't use `throws` (stored callbacks).
- `try?` only when failure truly doesn't matter; log otherwise.
- No `try!`, `!` force-unwrap or `as!` outside tests and genuinely
  impossible cases — and then document why it's impossible.
- `precondition` for programmer errors that must trap in release;
  `assert` for debug-only checks.

## 7. Memory and ARC

- Closures stored on `self` (callbacks, Combine sinks, timers) capture
  `self` strongly → cycle. Use `[weak self]` there; not by reflex in every
  closure (non-escaping closures and short-lived tasks don't need it).
- Delegates are `weak`.
- Long-lived `Task { … self … }` keeps `self` alive until it finishes:
  store the task and cancel it in `deinit` / `onDisappear`, or capture
  weakly inside a loop.
- `unowned` only when the lifetime relationship is guaranteed; otherwise
  `weak`.
- Find leaks with the Memory Graph Debugger and Instruments' Leaks /
  Allocations.

## 8. Performance

- Measure first (Instruments: Time Profiler, Allocations, SwiftUI).
- Copy-on-write keeps arrays/dictionaries cheap to pass, but mutating a
  copy inside a loop copies the buffer: mutate in place (`inout`,
  `modify` accessors).
- `reserveCapacity` when the final size is known.
- Avoid repeated `String` concatenation in loops; build with an array and
  `joined()` or a `String` with reserved capacity.
- `lazy` sequences for chains over large collections where you only need
  part of the result.
- `final` classes and `private` members enable static dispatch.
- Existentials (`any`) cost boxing and dynamic dispatch in hot paths —
  prefer generics there.
- `@inlinable` only in library code where cross-module specialisation is
  measured to matter.
- Ownership for hot or large values: `borrowing` / `consuming`
  parameters, `consume` to end a lifetime early, `~Copyable` types for
  unique resources (file handles, tokens).

## 9. Testing — Swift Testing

```swift
import Testing
@testable import Parser

@Suite("Parser")
struct ParserTests {
  let parser = Parser()

  @Test func emptyInputProducesNoNodes() throws {
    #expect(try parser.parse("").isEmpty)
  }

  @Test("Integers parse", arguments: ["1", "42", "-7"])
  func integers(_ input: String) throws {
    let value = try #require(Int(input))
    #expect(try parser.parse(input) == [.number(value)])
  }

  @Test func unterminatedStringReportsLine() {
    #expect(throws: ParseError.unterminatedString(line: 1)) {
      try parser.parse("\"abc")
    }
  }

  @Test(.tags(.slow), .timeLimit(.minutes(1)))
  func largeFile() async throws { … }
}
```

- `#expect` for checks (continues on failure), `#require` to unwrap or
  stop the test.
- Parameterised tests with `arguments:` instead of loops inside a test.
- Traits: `.tags`, `.enabled(if:)`, `.disabled("reason")`, `.bug(…)`,
  `.timeLimit`.
- Suites are structs: fresh state per test, no `setUp`/`tearDown` needed
  (use `init`/`deinit`).
- Async tests just `await`; use `confirmation` for callback/event counts.
- Tests run in parallel by default — no shared mutable state between them.
- Keep XCTest for UI tests and performance tests (`XCTMetric`), and
  migrate other suites gradually.

## 10. Modern language features agents often miss

| Older form | Modern form |
|---|---|
| `if let value = value` | `if let value` |
| Ternaries / temporary vars for branching values | `let x = if cond { a } else { b }`, `switch` expressions |
| `DispatchQueue.main.asyncAfter` | `try await Task.sleep(for: .seconds(1))` |
| `NSRegularExpression` | Regex literals `/\d+/` and `RegexBuilder` |
| `DateFormatter` / `NumberFormatter` | `.formatted()` and `FormatStyle` |
| `ObservableObject` + `@Published` | `@Observable` |
| `XCTAssertEqual` | `#expect(a == b)` |
| `PreviewProvider` | `#Preview { … }` |
| Hand-written boilerplate | Macros (only with a clear payoff) |
| Locks + `@unchecked Sendable` | `Mutex`, actors |
| `TimeInterval` maths | `Duration`, `ContinuousClock` |
| `Array(…).first(where:)` chains for counting | `count(where:)` |

## 11. Project hygiene

- Swift Package Manager for modules; split features into packages to
  speed up builds and enforce boundaries.
- Enable strict concurrency checking module by module when migrating;
  fix warnings before flipping to Swift 6 mode.
- SwiftLint / swift-format agreed once; don't reformat unrelated code
  (`skill-authoring-edho-ferdian` §10).
- Run the full test suite and build in release configuration before
  claiming a performance or concurrency fix.
