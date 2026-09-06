# Language Lens — .NET (C# / F#)

Adapted from ECC `csharp-reviewer`, `fsharp-reviewer`, `dotnet-patterns`,
`csharp-testing`, and `fsharp-testing`, fetched 2026-09-07.

**FOLD-M.** Content is medium-depth and plausible, ported straight from ECC's
.NET reviewer agents and pattern/testing skills, but **there is no evidence
of an active .NET project in Edho's workspace yet** — unlike Angular/NestJS
(verified against `ghostfolio`) or Python/React (already exercised elsewhere
in this ecosystem). Treat this file as a ready-to-use lens the moment a
matching .NET project shows up, not as field-validated. This file was
written ahead of its original DEFER trigger ("a real .NET project appears")
per the backlog-removal decision — the trigger gate is gone, the content
itself is not yet field-verified.

**Detect.** A `.csproj`/`.fsproj`/`.sln` file in scope, or any `.cs`/`.fs`/
`.fsx` file in review scope. A `.fsproj`/`.fs` file specifically routes to
the "## F#" subsection below in addition to the shared C#/.NET material —
F# and C# share the same runtime, DI container, EF Core, and ASP.NET Core
surface, so most of "Shared .NET criteria" applies to both; the F# section
covers only what's genuinely different (functional idioms, discriminated
unions, computation expressions).

**Boundary — read before flagging anything.** Generic injection, generic
secret handling, generic function-length/nesting/magic-number checks, and
generic N+1 detection are **already owned by `references/review-checklist.md`**
in the general skill. This lens adds only what is specific to **.NET's async/
await model, nullable reference types, DI container conventions, EF Core
query shape, and (for F#) functional-idiom correctness**.

**Code placement.** Findings land as **CQ-13 (.NET idiom/async/DI
anti-patterns)** in the general report. .NET-specific security items
(insecure deserialization via `BinaryFormatter`, missing
`[ValidateAntiForgeryToken]`, `TypeNameHandling.All`) belong to
`security-review-edho-ferdian/references/language-specific.md` once that
file covers .NET; until then, flag insecure deserialization here under
CRITICAL as an exception (see below), the same precedent `rust.md` sets for
unsafe-without-justification — it is a memory/data-integrity concern the
general skill has no other lens for yet.

---

## Ground-truth commands

```bash
dotnet build                                  # compile check — confirms type/nullable findings
dotnet format --verify-no-changes             # format check
fantomas --check .                            # F# format check (if the project uses Fantomas)
dotnet test --no-build                        # confirms behavior, not idiom quality
dotnet test --collect:"XPlat Code Coverage"   # coverage
dotnet list package --vulnerable              # dependency vulnerability scan (NuGet advisory DB)
dotnet list package --outdated                # stale dependency versions
```

Do not label a finding that a linter/analyzer would catch (unused `using`,
missing `ConfigureAwait`, an analyzer-flagged nullable warning) as [High
confidence] without having actually run `dotnet build`/`dotnet format` —
recognizing the pattern by eye is reasoning, not verification, per the
general skill's Phase 2 rule.

---

## Lens criteria (shared C# / .NET)

### CRITICAL

- **Blocking on async code**: `.Result`, `.Wait()`, or
  `.GetAwaiter().GetResult()` on a `Task`/`Task<T>` outside a genuinely
  synchronous entry point — the classic ASP.NET Core deadlock: a request
  thread blocks waiting for a continuation that needs the same
  synchronization context. Fix: `await` all the way up the call stack.
  **CQ-13.**
- **Insecure deserialization** — `BinaryFormatter` (obsolete and unsafe
  regardless of input trust), or `JsonSerializer`/`Newtonsoft.Json` with
  `TypeNameHandling.All`/`Auto` on data that could originate from a
  untrusted caller — allows arbitrary type instantiation. **CQ-13** (flagged
  here per the "Code placement" exception above until the security lens
  covers .NET).
- **Empty or swallowing catch block**: `catch { }`, `catch (Exception) { }`
  with no rethrow/logging, or `catch { return null; }` masking the actual
  failure — the general skill's error-handling checklist already owns
  generic swallowed exceptions; this is the .NET-specific instance worth
  calling out explicitly because `catch (Exception)` is unusually easy to
  reach for in C#. **CQ-13.**

### HIGH

- **Missing `CancellationToken` on a public async API** that performs I/O —
  callers can't cancel a hung request/query, and cascading cancellation
  through a service chain silently breaks the first time someone forgets to
  thread the token through. **CQ-13.**
- **`async void` outside an event handler** — exceptions thrown inside an
  `async void` method cannot be caught by the caller (they crash the
  process on .NET Core, or get silently lost depending on host); every
  async method that isn't an event handler should return `Task`. **CQ-13.**
- **Nullable reference type warnings suppressed with `!`** (the
  null-forgiving operator) as a default habit rather than a justified,
  provably-non-null case — this defeats the entire point of enabling
  `<Nullable>enable</Nullable>` in the project. Flag repeated `!` usage
  without a preceding null check or a comment justifying the guarantee.
  **CQ-13.**
- **`Box<dyn>`-equivalent for .NET: catching the base `Exception` type in
  library code and re-throwing a generic wrapped exception** instead of a
  specific, purpose-designed exception type — callers lose the ability to
  `catch` on a specific failure mode. **CQ-13.**
- **EF Core N+1 via lazy loading in a loop** — iterating a collection and
  accessing a lazy-loaded navigation property per iteration issues one
  query per row instead of a single `Include`/`ThenInclude`. This is the
  .NET-specific *mechanics* of N+1 (the general skill's checklist owns N+1
  as a concept; this is what it looks like in EF Core specifically).
  **CQ-13.**
- **`new SomeService()` inside a constructor or method body** instead of
  constructor injection — bypasses the DI container's lifetime management
  (scoped/singleton/transient) and makes the dependency untestable without
  a real instance. **CQ-13.**

### MEDIUM

- **Missing `AsNoTracking()` on a read-only EF Core query** — the change
  tracker pays a real cost to track entities that will never be mutated or
  saved back; flag on query methods that only read and return DTOs/
  projections. **CQ-13.**
- **`IEnumerable<T>` enumerated more than once** without materializing —
  each enumeration re-runs the underlying query or re-evaluates a lazy LINQ
  chain; if a sequence is iterated twice (e.g. once to count, once to
  project), materialize with `.ToList()`/`.ToArray()` first. **CQ-13.**
- **String concatenation in a loop** instead of `StringBuilder` or
  `string.Join` — same general performance concern as other languages, but
  .NET's specific fix is `StringBuilder`/interpolated string handlers.
  **CQ-13.**
- **Non-`sealed` class with no intended inheritors** — widens the type's
  override surface and defeats some JIT devirtualization optimizations for
  no benefit when nothing actually derives from it. **CQ-13.**
- **`dynamic` in application/business logic** — throws away compile-time
  type checking for convenience; acceptable at a genuine interop boundary
  (COM, some serialization edge cases), a MEDIUM finding everywhere else.
  **CQ-13.**
- **Options pattern bypassed** — reading `IConfiguration["Some:Key"]`
  directly at call sites instead of binding to a strongly-typed
  `IOptions<T>`/`IOptionsSnapshot<T>` — loses validation-at-startup and
  scatters magic string keys across the codebase. **CQ-13.**

---

## F#

F# shares the CLR, ASP.NET Core, EF Core, and DI container with C# — the
"Shared .NET criteria" above applies whenever an F# codebase touches those
surfaces (e.g. an F# EF Core repository still gets the N+1/`AsNoTracking`
findings above). What's genuinely different is F#'s functional-idiom
surface, ported from ECC `fsharp-reviewer`:

### HIGH

- **Mutable state (`mutable`, `ref` cells) in domain/business logic** where
  an immutable value + a function returning a new value would suffice — F#
  defaults to immutability; reaching for `mutable` in domain logic is
  usually a sign the code is fighting the language rather than using it.
  **CQ-13.**
- **Incomplete pattern match, or a catch-all `_` arm that hides new union
  cases** — same concern as Rust's wildcard-match finding (`rust.md`
  CQ-12): F#'s compiler warns on incomplete matches by default (`FS0025`),
  but a wildcard arm silences that guarantee. Flag a `_ ->` arm on a match
  over an internal domain DU that would otherwise force every call site to
  handle a new case. **CQ-13.**
- **`null` used for a missing value instead of `Option<'T>`** — F#
  interop with .NET libraries sometimes forces `null` at the boundary, but
  domain code choosing `null` over `Option` throws away the compiler's
  ability to force callers to handle the missing case. **CQ-13.**
- **Class-heavy, OOP-style design where modules + functions + records would
  be simpler** — a class with mutable private fields and methods mutating
  `this` state, ported wholesale from a C#-shaped mental model, when the
  same logic is more testable and composable as a module of pure functions
  over an immutable record. **CQ-13.**

### MEDIUM

- **Primitive obsession**: a bare `string`/`int` for a domain concept
  (customer ID, email) that would benefit from a single-case discriminated
  union (`type CustomerId = CustomerId of string`) to prevent argument-order
  mix-ups at call sites with multiple same-typed parameters. **CQ-13.**
- **Imperative `for`/`while` loop where `List.map`/`Seq.filter`/
  `Array.fold` is clearer** — flag only when the functional form is
  genuinely more readable for the specific transformation, not as a blanket
  style preference. **CQ-13.**
- **Missing `[<RequireQualifiedAccess>]` on a module or union whose case
  names collide with common identifiers** (e.g. a `Result` or `Status`
  union with cases like `Ok`/`Error`/`Pending` that shadow common names) —
  without it, an `open` elsewhere in the codebase can silently shadow the
  case name. **CQ-13.**
- **Overly long pipe (`|>`) chains** hurting readability — break into named
  intermediate `let` bindings once a chain exceeds roughly 4-5 stages or
  mixes unrelated transformations. **CQ-13.**
- **Nested computation expressions** (`task { task { ... } }`,
  `async { async { ... } }`) instead of flattening with `let!`/`do!` — a
  common mistake when porting C# async code to F# task expressions
  line-by-line. **CQ-13.**

---

## Testing lens (from `csharp-testing` / `fsharp-testing`)

- **Arrange-Act-Assert structure**, `[Fact]`/`[Theory]` (xUnit is ECC's and
  this ecosystem's preferred .NET test framework) — flag tests that mix
  arrange/act/assert without a clear boundary, or that assert on
  implementation details (`.ToString()` output, internal field state)
  instead of typed properties/behavior.
- **`Thread.Sleep` in an async test** instead of `Task.Delay` with a
  timeout or a polling helper — a hard sleep makes the test slower than
  necessary and doesn't actually guarantee the awaited condition is met by
  the time execution resumes.
- **`CancellationToken` ignored in tests** — a test exercising an async API
  that accepts a token but never passes/asserts on cancellation behavior is
  missing real coverage of a documented contract.
- **F# specifically: property-based tests (`FsCheck`) missing for a
  function with an obvious invariant** — e.g. a serializer round-trip
  (`deserialize(serialize(x)) = x`) or a total-ordering function — flag
  absence only where the invariant is genuine, not universally, mirroring
  the same discipline `rust.md`'s testing lens applies to `proptest`.
- **Over-mocking a stateful dependency with NSubstitute/Moq** where a fake
  (an in-memory implementation, or F#'s function-stub-record pattern from
  `fsharp-testing`) would exercise more real behavior — the general skill's
  `test-quality-lens.md` already owns "mock everything" as an anti-pattern;
  this is the .NET-specific instance.
- **Coverage via `dotnet test --collect:"XPlat Code Coverage"`**, same
  targets as the general skill's Domain 5 (100% critical logic, 90%+ public
  API, 80%+ general).

---

## False-positive traps

- `.Result`/`.Wait()` inside a `Program.cs` top-level synchronous `Main`
  that intentionally blocks until startup completes (not inside a request
  or service method) is a narrower, more defensible case — verify it's
  genuinely the application's synchronous entry point before flagging at
  the same severity as a blocking call inside a request handler.
- The null-forgiving operator (`!`) directly after a null check the
  compiler's flow analysis doesn't yet narrow (a common false-positive
  source for `CS8602` warnings on well-guarded code) is a legitimate,
  narrow use — verify the guard actually exists nearby before flagging.
- `dynamic` at a genuine COM interop or `ExpandoObject`-based dynamic
  configuration boundary is the documented acceptable case — the finding is
  about business/domain logic reaching for `dynamic` out of convenience.
- F#: a wildcard `_ ->` arm on a match over a `.NET` BCL enum or a
  genuinely external/foreign DU (from a NuGet package you don't control) is
  often the *correct* defensive choice — the finding is about internal
  domain DUs only, same nuance as Rust's equivalent trap.

## Escalate to general domain when…

- The finding is generic injection/secret-handling with no .NET-specific
  nuance — that's the general skill's SEC domain.
- The finding is about test coverage percentage rather than .NET-specific
  test mechanics — Domain 5 (`test-quality-lens.md`).
- A performance claim needs a BenchmarkDotNet run to confirm — escalate to
  `performance-audit-edho-ferdian` rather than asserting from code reading
  alone.

## Provenance

Adapted from ECC `csharp-reviewer` (agent), `fsharp-reviewer` (agent),
`dotnet-patterns` (skill), `csharp-testing` (skill), and `fsharp-testing`
(skill), fetched 2026-09-07.
