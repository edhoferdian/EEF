# Swift Authoring — modern Swift, written well

Use when you write new Swift, move code to Swift 6, or chase a race, a
deadlock, a leak or a slow path in Swift.
Reviewing Swift belongs to `language-code-review-edho-ferdian`
(`references/swift.md`); build errors to `build-fix-edho-ferdian`.

Swift moves fast. Check the project's Swift version and language mode
(Package.swift `swiftLanguageModes`, Xcode build settings) and look up
current behaviour (Context7, swift.org evolution proposals) before relying
on anything version-specific.

## Modelling

- **Value types first.** `struct` and `enum` for data; `class` only for
  identity, shared mutable state, or framework requirements. `actor` for
  shared mutable state across concurrency.
- **Make illegal states unrepresentable** with enums with associated
  values instead of several optionals and flags.
- `let` by default; narrow access control (`private`, `fileprivate`,
  `internal`); `final` on classes not designed for subclassing.
- Prefer `Codable`, `Identifiable`, `Hashable`, `Sendable` conformances
  synthesised by the compiler.
- `@Observable` (Observation framework) instead of `ObservableObject` +
  `@Published` for new SwiftUI models.

## Concurrency (Swift 6)

**Data-race safety** in the Swift 6 language mode turns races into compile
errors. Fix them by design, not by silencing:

- Types crossing isolation boundaries must be `Sendable`. Value types of
  Sendable members are Sendable automatically (when not public). Classes:
  make them `final` with immutable state, or turn them into actors.
- **`@unchecked Sendable` is a promise the compiler can't check.** Use it
  only for types with real internal synchronisation (`Mutex` from the
  Synchronization module, a lock) and say so in a comment.
- **Mutable globals and statics** trip the checker most often. Fix them, in
  this order of preference: make it a `let`; isolate it to `@MainActor`; wrap it in a `Mutex`
  or an actor; `nonisolated(unsafe)` only as a documented last resort.
- `sending` parameters/results transfer a non-Sendable value safely into
  another isolation domain.

**Approachable concurrency (Swift 6.2 era).** Projects can opt into
main-actor-by-default isolation (good for app targets: most code is UI)
and the rule that `nonisolated async` functions run on the caller's actor.
In that world, mark work that must leave the caller's actor with
`@concurrent`. Check which settings the project enables before reasoning
about where code runs.

**Structure:**
- `async let` for a fixed number of parallel child tasks; `withTaskGroup`
  / `withThrowingTaskGroup` for a dynamic number. Bound the concurrency —
  don't spawn one child per item of an unbounded list; keep a window of
  N in flight.
- Avoid unstructured `Task { }` unless bridging from synchronous code;
  never `Task.detached` without a reason. Keep the handle if it must be
  cancelled.
- Check cancellation in long loops (`try Task.checkCancellation()`).
- Never block a thread waiting for async work (semaphores, `DispatchGroup`
  `wait`) — it deadlocks the cooperative pool.
- Actor reentrancy: state can change across an `await` inside an actor;
  re-check invariants after each suspension.
- `AsyncStream` to bridge callbacks/delegates into async sequences.

## Protocols and generics

- `some Protocol` (opaque) when one concrete type is returned/accepted;
  `any Protocol` (existential) only when you need heterogeneous values.
  Prefer `some` in parameters: `func render(_ view: some View)`.
- Primary associated types (`some Collection<Int>`) instead of verbose
  where-clauses.
- Protocol extensions for shared default behaviour; don't make protocols
  for a single conformer "just in case".

## API design

Follow the Swift API Design Guidelines: clarity at the point of use, name
by role not type, argument labels that read as phrases, mutating/non-
mutating pairs (`sort`/`sorted`), Boolean names that read as assertions
(`isEmpty`).

## Errors

- `throws` with specific error enums; typed throws (`throws(ParseError)`)
  where callers benefit from exhaustive handling, mostly in internal or
  embedded code.
- `Result` only at boundaries that can't use `throws`.
- No `try!` / force unwraps outside tests and truly impossible cases.

## Memory and performance

- ARC: watch closures stored on `self` (`[weak self]` where the closure
  outlives the call; not by reflex everywhere). Delegates `weak`.
- Retain cycles in async: a long-lived `Task` capturing `self` keeps it
  alive — cancel in `deinit`/`onDisappear` or capture weakly.
- Copy-on-write makes value types cheap to pass; avoid accidental copies
  of large arrays inside loops (mutate in place, `reserveCapacity`).
- Mark hot generic code `@inlinable` only in libraries where it matters;
  measure with Instruments before optimising.

## Testing — Swift Testing

```swift
import Testing

@Suite struct ParserTests {
  @Test func parsesEmptyInput() throws {
    let result = try Parser().parse("")
    #expect(result.isEmpty)
  }

  @Test(arguments: ["1", "42", "-7"])
  func parsesIntegers(_ input: String) throws {
    let value = try #require(Int(input))
    #expect(try Parser().parse(input) == [value])
  }
}
```

`#expect` for checks, `#require` to unwrap or stop, parameterised tests
with `arguments:`, traits for tags and conditions. Keep XCTest only where
UI tests or existing suites need it.

## Modern features agents often miss

- `if`/`switch` as expressions; `guard let x` shorthand (`if let x`).
- Macros: `#Preview`, `@Observable`, `#expect`; write your own only with a
  clear payoff.
- `consume`, `borrowing`/`consuming`, `~Copyable` for ownership-sensitive
  code.
- Regex builders and literals instead of NSRegularExpression.
- `FormatStyle` (`.formatted()`) instead of manual formatters.
- `Duration` and `Clock` instead of raw `TimeInterval` sleeps
  (`try await Task.sleep(for: .seconds(1))`).
