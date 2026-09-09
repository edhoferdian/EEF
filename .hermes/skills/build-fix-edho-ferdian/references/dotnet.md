# .NET — MSBuild, dotnet CLI, NuGet & test-bootstrap lens

**FOLD-M.** Content is medium-depth and plausible, but **there is no
evidence of an active .NET project in Edho's workspace yet** — unlike
JavaScript/TypeScript and Django/Python (FOLD-P) which back real work
already in this ecosystem. Treat this file as a diagnostic lens ready to use
the moment a .NET project shows up, not as field-validated. Written ahead of
its original DEFER trigger ("a real .NET project appears") per the
backlog-removal decision.

Scope: `dotnet build`/`dotnet restore` failures, MSBuild errors, NuGet
dependency resolution conflicts, and xUnit/NUnit test-host bootstrap
failures (both C# and F# projects — they share the same MSBuild/NuGet/test-
host toolchain; the error tables below apply to both `.csproj` and
`.fsproj`). You fix the error only — you do not restructure project
architecture or change public APIs beyond what the error demands.

## Diagnostic commands

Run these in order to localize the error before touching anything:

```bash
# Confirm toolchain and SDK state
dotnet --version
dotnet --list-sdks
dotnet --info

# Restore first — most "build" failures are actually restore failures
dotnet restore

# The actual build — capture the exact, unedited output
dotnet build

# Verbose build output when the error message alone isn't enough
dotnet build -v:detailed

# NuGet dependency graph state
dotnet list package
dotnet list package --include-transitive
dotnet nuget locals all --list
```

## Resolution workflow

```
1. Reproduce the error            -> capture the FULL dotnet/MSBuild diagnostic,
                                      unedited (MSBuild error codes like CS0246,
                                      NU1605, NETSDK1004 are searchable and specific
                                      — quote the exact code, don't paraphrase)
2. Identify the error family      -> use the tables below
3. Read the affected file/project -> understand context before editing
4. Apply the minimal fix          -> only what the error demands
5. dotnet build                   -> confirm the specific error is gone
6. dotnet test                    -> confirm nothing else broke
```

**Read the full MSBuild diagnostic, not just the summary line.** MSBuild
error output often buries the real root cause several lines above the final
"Build FAILED" summary — a downstream `CS****` compiler error can be caused
by an upstream `NU****` restore failure that already scrolled past.

## Compiler errors (CS**** / FS****)

| Error | Cause | Fix |
|---|---|---|
| `CS0246: The type or namespace name 'X' could not be found` | Missing `using`, missing project/package reference, or a typo | Add the `using`, confirm the containing package/project is referenced in the `.csproj`, check spelling |
| `CS0103: The name 'X' does not exist in the current context` | Undeclared identifier, wrong scope, or a typo | Confirm the identifier is declared and in scope; check for a missing `using static` or namespace import |
| `CS1061: 'T' does not contain a definition for 'X'` | Method/property doesn't exist on that type, or the extension method's namespace isn't imported | Check the exact member name and whether an extension method's `using` is missing |
| `CS8618: Non-nullable property/field must contain a non-null value when exiting constructor` | Nullable reference types enabled (`<Nullable>enable</Nullable>`) and a required member isn't initialized | Initialize in the constructor, mark the property `required`, or make the type genuinely nullable (`string?`) if it can legitimately be absent — don't blanket-suppress with `!` |
| `CS0122: 'X' is inaccessible due to its protection level` | Accessing a `private`/`internal` member from outside its allowed scope | Confirm which access level is actually correct for the design — don't widen visibility just to make the error go away without checking whether it should be public |
| `FS0001: This expression was expected to have type 'A' but here has type 'B'` | F# type mismatch — F#'s type inference is stricter about mismatches than C# | Read which side the compiler inferred first (F# infers left-to-right/top-to-bottom); add an explicit type annotation at the ambiguous point |
| `FS0025: Incomplete pattern matches on this expression` | A `match` doesn't cover all cases of a union/type | Add the missing case(s) explicitly — do not silence with a wildcard `_ ->` unless every remaining case is genuinely a "shouldn't happen, if it does throw or return a default" scenario, and say so in a comment |
| `FS0039: The value or constructor 'X' is not defined` | F# equivalent of `CS0103` — undeclared identifier, wrong `open`, or a typo, and F# is order-sensitive (a value/function must be defined *above* its use in the same file) | Confirm the identifier exists, the right module is `open`ed, and — F#-specific — that it's actually declared earlier in file/compile order |

```bash
dotnet build -v:normal 2>&1 | grep -E "error (CS|FS|NETSDK)"   # isolate error lines in a noisy build log
```

## NuGet dependency resolution (`NU****`)

| Error | Cause | Fix |
|---|---|---|
| `NU1605: Detected package downgrade` | A transitive dependency needs a higher version than what's directly referenced | Add an explicit `<PackageReference>` pinning the higher version directly, rather than letting the downgrade happen silently |
| `NU1101: Unable to find package 'X'` | Wrong package name/typo, or the configured NuGet source doesn't have it | Check spelling on nuget.org, confirm `NuGet.Config` / `dotnet nuget list source` actually includes the feed that hosts it |
| `NU1102: Unable to find package 'X' with version 'Y'` | The named version doesn't exist for that package | Check the actual published versions on nuget.org/the private feed; a typo'd or yanked version is the most common cause |
| `NU1608: Detected package version outside of dependency constraint` | Two packages' declared dependency ranges conflict for a shared transitive package | `dotnet list package --include-transitive` to see the full graph, then pin the correct version explicitly at the top level |
| `NU1201: Project X is not compatible with netY.Z` | Target framework mismatch between the project and a referenced package/project | Confirm the actual minimum framework the dependency requires; don't downgrade the dependency's target — align the consuming project's `<TargetFramework>` if that's genuinely the intended fix, and flag if it isn't a narrow build fix |
| `error: unable to resolve dependency tree` / restore hangs | Corrupted local NuGet cache, or an unreachable/misconfigured feed | `dotnet nuget locals all --clear` then `dotnet restore` — confirm this isn't a shared CI cache before clearing it |

```bash
dotnet list package --include-transitive         # full transitive graph — find the actual conflict
dotnet nuget locals all --clear                  # clear NuGet caches (confirm before running on shared/CI machines)
dotnet restore --force --no-cache                # force a clean restore bypassing the local cache
```

## MSBuild / SDK errors (`NETSDK****`, `MSB****`)

| Error | Cause | Fix |
|---|---|---|
| `NETSDK1045: The current .NET SDK does not support targeting Y` | Installed SDK is older than the project's `<TargetFramework>` | Install the required SDK version, or confirm with the user before lowering `<TargetFramework>` — a target framework change is a project-wide scope decision, not a narrow build fix |
| `NETSDK1004: Assets file 'obj/project.assets.json' not found` | `dotnet restore` was never run, or `obj/`/`bin/` are stale/corrupted | `dotnet restore`, and if that doesn't resolve it, delete `obj/`+`bin/` and restore again (confirm the directories are genuinely build artifacts, not tracked source) |
| `MSB1009: Project file does not exist` | Wrong path/filename passed to `dotnet build`, or a `.sln` references a `.csproj` that was moved/renamed | Check the exact path in the command and in the `.sln`'s project reference entries |
| `MSB4025: The project file could not be loaded. Data at the root level is invalid.` | Malformed XML in the `.csproj`/`.fsproj` (often from a bad manual edit) | Open the file and find the exact malformed tag — a missing closing tag or an escaped character is the usual cause |
| `error MSB3644: The reference assemblies for framework "..." were not found` | A targeting pack for the specified framework isn't installed | Install the matching targeting pack/SDK workload rather than changing the target framework |
| `Global.json` SDK version mismatch (`dotnet build` picks the wrong SDK silently) | `global.json` pins an SDK version not installed on this machine | `dotnet --list-sdks` to see what's actually installed, then either install the pinned version or confirm with the user before changing `global.json`'s pin |

```bash
dotnet --list-sdks                 # what SDKs are actually installed
cat global.json                    # what SDK version this repo pins (if present)
dotnet build -bl                   # binary log for deep MSBuild diagnostics (open with MSBuild Structured Log Viewer)
```

## xUnit / NUnit test-host bootstrap failures

| Error | Cause | Fix |
|---|---|---|
| `No test is available in <assembly>` | Test project isn't referencing the correct test SDK package (`Microsoft.NET.Test.Sdk`), or tests aren't discoverable (missing `[Fact]`/`[Test]` attributes, or an internal class without `[assembly: InternalsVisibleTo]` if tests live in a separate assembly) | Confirm `Microsoft.NET.Test.Sdk` + the xUnit/NUnit runner package are referenced; confirm test methods are actually attributed and public (or internal with `InternalsVisibleTo`) |
| `The active test run was aborted` / test host crashes immediately | An unhandled exception in a fixture's constructor or `[ClassInitialize]`/`IAsyncLifetime.InitializeAsync`, or a native dependency (e.g. a Testcontainers image) failing to start | Run a single failing test in isolation (`dotnet test --filter`) to isolate the fixture; check Docker/container-runtime availability if the fixture depends on Testcontainers |
| `Method X does not have a valid test signature` (xUnit) | An async test method returns `void` instead of `Task`, or `[Fact]` is applied to a method with parameters (needs `[Theory]` + `[InlineData]`/`[MemberData]`) | Change the return type to `Task`/`ValueTask` for async tests; switch to `[Theory]` if the method takes parameters |
| `System.IO.FileNotFoundException: Could not load file or assembly 'X'` during test run | A test-only dependency isn't copied to the test output directory, or a native dependency (SQLite, a native Testcontainers binding) is missing for the current OS/architecture | Confirm the package is referenced by the test project (not just the main project) and that `CopyLocalLockFileAssemblies` isn't disabled for a dependency the test host needs at runtime |
| `WebApplicationFactory<Program>` fails to start (`InvalidOperationException` about entry point) | The target project's `Program.cs` uses top-level statements and needs a `public partial class Program` marker for the test project to reference it | Add `public partial class Program { }` at the end of `Program.cs` in the tested project — a one-line, narrow addition, not an architectural change |

```bash
dotnet test --filter "FullyQualifiedName~TestClassName"   # isolate one failing test/fixture
dotnet test -v:detailed                                    # verbose test-host output
dotnet test --list-tests                                   # confirm discovery actually found the test
```

## Anti-suppression reminders specific to this stack

- Never suppress a `CS8618`/nullable-warning family error with a blanket
  `#nullable disable` at the top of the file — scope any suppression to the
  single line/member with `#pragma warning disable CS8618` plus a comment
  explaining why, or better, actually initialize the value.
- Never add the null-forgiving operator (`!`) as the default fix for a
  nullable-reference-type build warning — verify the value is provably
  non-null at that point first (see the review lens's HIGH section on `!`
  overuse).
- Never bump a package's major version, change `<TargetFramework>`, or edit
  `global.json`'s SDK pin to resolve a restore/build conflict without
  flagging it to the user first — each is an architectural/scope decision,
  not a build fix, even when it "just works."
- Never wildcard-match (`_ ->`) an F# `FS0025` incomplete-match error away
  unless every uncovered case is genuinely a deliberate catch-all — say so
  in a comment if you do.
- Never hand-edit `packages.lock.json` (if the project uses locked mode) —
  the only correct way to change it is `dotnet restore --force-evaluate`
  regenerating it from the actual dependency graph.
