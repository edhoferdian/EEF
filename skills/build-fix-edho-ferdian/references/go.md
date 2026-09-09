# Go — build, vet & module resolution lens

**FOLD-M.** Kelompok 1 lanjutan: konten sedang, plausibel,
tapi **belum ada bukti proyek Go aktif** di workspace Edho saat ini — beda
dari lens JavaScript/TypeScript dan Django/Python (FOLD-P) yang sudah
dipakai pada proyek nyata di ekosistem ini. Perlakukan file ini sebagai
diagnostic lens siap-pakai begitu proyek Go muncul, bukan sebagai sesuatu
yang sudah tervalidasi lapangan.

Scope: `go build`/`go vet` failures, unused imports/variables, type
mismatches, and module (`go.mod`/`go.sum`) resolution errors. You fix the
error only — you do not refactor package structure or change function
signatures beyond what the error demands.

## Diagnostic commands

Run these in order to localize the error before touching anything:

```bash
# Confirm toolchain and module state
go version
go env GOFLAGS GOPATH GOMODCACHE

# The actual build — capture the exact, unedited output
go build ./...

# Static analysis catches issues that compile but are still wrong
go vet ./...

# Module consistency
go mod verify
go list -m all

# Fast type-check without full codegen (large modules, quicker feedback loop)
go build -o /dev/null ./...
```

## Resolution workflow

```
1. Reproduce the error           -> capture the exact message, unedited
2. Identify the error family     -> use the tables below
3. Read the affected file        -> understand context before editing
4. Apply the minimal fix         -> only what the error demands
5. go build ./... && go vet ./... -> confirm the package tree compiles clean
6. go test ./...                 -> confirm nothing else broke
```

## Compile errors

| Error | Cause | Fix |
|---|---|---|
| `imported and not used: "pkg"` | Import present but no identifier from it is referenced | Remove the import, or use the identifier if it was meant to be used (check for a typo in the reference first) |
| `declared and not used: x` | Local variable assigned but never read | Remove the variable, or use `_ = x` only if the assignment itself has a side effect worth keeping (rare — usually just delete it) |
| `cannot use x (variable of type A) as type B` | Type mismatch at a call site or assignment | Convert explicitly (`B(x)`) only if the conversion is semantically valid; otherwise the caller or the function signature has the wrong type — read which side is actually correct before changing either |
| `undefined: X` | Identifier doesn't exist in the current package/import scope, or a typo | Check the exact spelling and the import path; confirm the package that should export `X` actually does (capitalized = exported) |
| `missing return` | Not every path through a function with a return type produces a value | Add the missing `return` on the falling-through path — don't add a naked `return` that silently returns zero values on error paths |
| `too many / not enough return values` | Call site doesn't match the function's actual signature (common after refactoring elsewhere) | Match the call site to the current signature; if this function's signature just changed intentionally, propagate the new shape to every call site, one at a time |
| `invalid operation: mismatched types A and B` | Comparing or operating on incompatible types (e.g. `int` vs `int64`) | Convert one side explicitly; Go never does this implicitly |

```bash
# Narrow down which package actually fails first in a multi-package build
go build ./... 2>&1 | head -20

# Confirm a specific package in isolation
go build ./path/to/package
```

## `go vet` findings (compile-clean but flagged)

| Error | Cause | Fix |
|---|---|---|
| `Printf call has arg X of wrong type` | Format verb (`%d`, `%s`, ...) doesn't match the argument's actual type | Correct the verb or the argument — this is a real bug `vet` catches that the compiler doesn't |
| `struct field tag not compatible with reflect.StructTag.Get` | Malformed struct tag (e.g. `json:"name" json:"other"`, missing quotes) | Fix the tag syntax exactly — a broken tag silently fails to (de)serialize the field with no runtime error |
| `possible misuse of unsafe.Pointer` | An `unsafe` conversion `vet` can't prove is sound | Read the surrounding code carefully before dismissing — this is a real signal, not noise; escalate if the fix requires redesigning the unsafe boundary |
| `range variable X captured by func literal` (older Go) | Loop variable captured by a closure/goroutine, all iterations see the final value | Capture per-iteration (`x := x` before the closure) — irrelevant on Go 1.22+ where loop vars are per-iteration by default; confirm the module's `go.mod` `go` directive first |

```bash
go vet ./...
go vet -all ./...   # includes additional analyzers beyond the default set
```

## Module resolution (`go.mod` / `go.sum`)

| Error | Cause | Fix |
|---|---|---|
| `go: module X: Get "https://...": ...` | Network/proxy issue, or the module truly doesn't exist at that path/version | Check `GOPROXY`/`GONOSUMCHECK` env, confirm the module path and version tag actually exist upstream |
| `missing go.sum entry for module` | `go.sum` wasn't regenerated after a dependency change | `go mod tidy` (regenerates both `go.mod` and `go.sum` consistently) |
| `ambiguous import: found package X in multiple modules` | Two required modules both provide the same import path (version conflict) | `go mod graph` to find the conflicting requirement, then `go mod edit -require=X@version` to pin the correct one, followed by `go mod tidy` |
| `go.mod file indicates X, but go.sum has Y` | Checksum mismatch — corrupted cache or a tampered dependency | `go clean -modcache` then `go mod download` to re-fetch from a clean state |
| `updates to go.sum needed` | Same root cause as the missing-entry case above, different wording | `go mod tidy` |

```bash
go mod tidy                 # regenerate go.mod/go.sum from actual imports
go mod graph                # full dependency graph — find where a conflict originates
go mod why -m module/path   # why is this module even required
go clean -modcache          # nuclear option for a corrupted module cache — confirm this
                             # isn't a shared/CI environment where other builds depend on
                             # the warm cache before running it
go mod verify                # confirm cached modules match go.sum checksums
```

## Type mismatch deep-dive

Most Go type errors are one of three shapes — identify which before editing:

1. **Wrong concrete type passed where an interface was expected**, but the
   concrete type doesn't actually implement the interface (missing method,
   or a method with a pointer receiver called on a value, or vice versa).
   Read the interface definition and the type's method set exactly —
   pointer vs. value receiver changes which method set satisfies the
   interface.
2. **Numeric type mismatch** (`int` vs `int64` vs `float64`) — Go has zero
   implicit numeric conversion; every boundary between differently-sized/
   signed number types needs an explicit conversion.
3. **Nil map/slice used before initialization** — `var m map[string]int;
   m["x"] = 1` compiles but panics at runtime (`assignment to entry in nil
   map`), which is a `go vet`-invisible, `go build`-invisible runtime error
   — if this is what actually failed (a panic, not a compile error), it
   still belongs in this file's diagnostic table because it's the same
   "zero value isn't always useful" class of Go-specific gotcha. Fix: `m :=
   make(map[string]int)` before first use.

## Anti-suppression reminders specific to this stack

- Never add a blanket `//nolint` or `// nolint:all` comment to silence a
  linter finding — scope it to the specific rule
  (`//nolint:errcheck // reason`) with a stated reason, or fix the
  underlying issue.
- Never replace a real type-mismatch fix with an `interface{}`/`any`
  parameter just to make the compiler stop complaining — that erases the
  type safety the error was protecting and pushes the failure to runtime.
- Never run `go clean -modcache` on a shared or CI machine without
  confirming with the user first — it forces every other in-flight build on
  that machine to re-download its full module cache.
- Never hand-edit `go.sum` — it's a generated, checksum-verified file;
  the only correct way to change it is `go mod tidy` / `go mod download`
  regenerating it from the real dependency graph.
