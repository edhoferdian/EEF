# Language Lens — Go

Adapted from ECC `golang-patterns` and `golang-testing`, fetched 2026-09-06.

**FOLD-M.** Kelompok 1 lanjutan: konten sedang, plausibel dari sumber ECC,
tapi **belum ada bukti proyek Go aktif** di workspace Edho saat ini — beda
dari lens Python/React (FOLD-P) yang sudah dipakai pada proyek nyata di
ekosistem ini. Perlakukan file ini sebagai lens siap-pakai begitu proyek Go
muncul, bukan sebagai sesuatu yang sudah tervalidasi lapangan.

**Detect.** A `go.mod` at repo root, or any `.go` file in review scope. No
sub-framework split yet (unlike Python/Django/FastAPI) — Go's stdlib-first
culture means most idiom concerns apply uniformly whether it's a CLI, an
HTTP service, or a library.

**Boundary — read before flagging anything.** Generic injection (SQL/command/
path traversal via string concatenation), generic secret handling, generic
function-length/nesting/magic-number checks, and generic N+1 detection are
**already owned by `references/review-checklist.md`** in the general skill.
This lens adds only what is specific to **Go's language idioms, concurrency
model, and interface design** — error-wrapping discipline, goroutine/channel
correctness, and Go-specific naming/structure conventions.

**Code placement.** Findings land as **CQ-11 (Go idiom & concurrency
anti-patterns)** in the general report. Go-specific security items (if any
surface — e.g. `exec.Command` with unsanitized args, weak crypto) belong to
`security-review-edho-ferdian/references/language-specific.md`; this file
does not duplicate them.

---

## Ground-truth commands

```bash
go build ./...                 # compiles — confirms type/syntax findings
go vet ./...                   # catches shadowing, struct tag mistakes, printf-format bugs
staticcheck ./...              # deeper static analysis, catches most idiom findings below
golangci-lint run              # aggregated linter (errcheck, ineffassign, unused, gosimple)
go test -race ./...            # race detector — the only real way to confirm a goroutine data race
go test -run TestName -timeout 30s ./...   # deadlock/hang detection via timeout
```

Do not label a goroutine-leak or data-race finding as [High confidence]
without actually having run (or having strong evidence the user ran)
`go test -race`. Reading a `go func() { ch <- v }()` and recognizing the
missing-receiver shape is reasoning, not verification — cap at [Medium
confidence] and name `go test -race` as the confirming command, per the
general skill's Phase 2 rule.

---

## Lens criteria

### HIGH

- **Ignored error (`_ = err` or `result, _ := f()`)** on a call whose error
  is not genuinely inconsequential — Go's error-as-value model means a
  dropped error is a silent failure with no stack trace to follow later.
  Acceptable only for a documented best-effort cleanup (`_ =
  writer.Close() // logged elsewhere`), never for a call whose failure
  changes program correctness. **CQ-11.**
- **Goroutine leak** — a `go func() { ... }()` that can block forever on an
  unbuffered channel send/receive with no `context.Context` cancellation
  path and no buffered/select-with-`ctx.Done()` escape. Every spawned
  goroutine needs a way to exit if its caller/consumer disappears. **CQ-11.**
- **Channel deadlock shape** — sending on an unbuffered channel with no
  concurrent receiver ready (common in test code and in code paths gated by
  an early return that skips draining a channel already being written to).
  Flag the specific missing receiver/buffer, not just "channels are
  dangerous." **CQ-11.**
- **Missing `defer mu.Unlock()` immediately after `mu.Lock()`** — any
  early-return or panic path between lock and a manually-placed `Unlock()`
  leaves the mutex held forever. The idiomatic form locks and defers the
  unlock on the very next line. **CQ-11.**
- **Broken error chain** — `fmt.Errorf("...: %v", err)` instead of `%w` when
  the caller might reasonably want `errors.Is`/`errors.As` on the
  underlying error. `%v` flattens the error to a string and severs the
  chain. **CQ-11.**
- **Interface pollution** — an interface defined in the *provider* package
  with many methods, instead of a small (often single-method) interface
  defined in the *consumer* package that only names what it actually calls.
  This is Go's accept-interfaces/return-structs idiom inverted; large
  provider-side interfaces force every implementation (including mocks) to
  satisfy methods the consumer never uses. **CQ-11.**
- **Data race on shared state accessed from multiple goroutines without a
  mutex, channel, or `sync/atomic`** — most reliably caught by `go test
  -race`; reading the code and spotting an unsynchronized shared map/slice
  write from two goroutines is a valid [Medium confidence] finding pending
  that run. **CQ-11.**

### MEDIUM

- **Non-idiomatic naming** — package names that are verbose, mixed-case, or
  redundant (`userService` inside package `user`, `httpHandler` instead of
  `http`); exported identifiers using `Get` prefixes where Go convention
  omits them (`GetName()` → `Name()` for a simple accessor, reserving `Get`
  for something that actually performs work like an I/O fetch). **CQ-11.**
- **Naked return in a function longer than a few lines** — `return` with no
  values inside a long function relies on named return values the reader
  has to scroll back to find; fine in a 3-line function, a real readability
  cost past that. **CQ-11.**
- **`panic` used for ordinary control flow / expected error conditions** —
  Go reserves `panic` for programmer errors and unrecoverable states; a
  function that can fail in an expected way (not-found, invalid input)
  should return `(T, error)`, not panic. **CQ-11.**
- **Mixed value/pointer receivers on the same type** — some methods on `T`,
  others on `*T`, without a documented reason. Pick one receiver style per
  type and stay consistent; inconsistency causes subtle bugs when the
  value/pointer distinction affects whether a mutation is visible to the
  caller. **CQ-11.**
- **Missing `t.Helper()` in a Go test helper function** — without it,
  failure line numbers point inside the helper instead of at the call site
  that actually failed, making table-driven test failures harder to
  localize. **CQ-11 / testing note below.**
- **Missing `t.Parallel()` on independent table-driven subtests** — not a
  correctness bug, but a missed opportunity that the general skill's
  performance domain won't catch because it's Go-test-specific; flag only
  when subtests are genuinely independent (no shared mutable fixture).
- **Preallocatable slice grown via repeated `append` with a known final
  size** — `results := make([]T, 0, len(items))` avoids multiple
  reallocations; flag only when the size is actually known ahead of the
  loop, not a blanket suggestion.
- **`context.Context` stored in a struct field** instead of passed as the
  first parameter of the functions that need it — Go convention treats
  `ctx` as a call-scoped value, not object state; storing it hides the
  cancellation scope and makes it easy to reuse a stale, already-cancelled
  context. **CQ-11.**

---

## Testing lens (from `golang-testing`)

- **Table-driven test structure is the default** for any function with more
  than two or three input variations — a `[]struct{name string; ...}` slice
  iterated with `t.Run(tt.name, ...)`, not a sequence of separate `TestX1`,
  `TestX2` functions repeating the same assertions.
- **`t.Parallel()` inside the `t.Run` closure**, with the loop variable
  captured correctly (`tt := tt` before Go 1.22, unnecessary from Go 1.22
  onward where loop variables are per-iteration) — check the module's Go
  version in `go.mod` before flagging the capture as a bug; it is only a
  bug pre-1.22.
- **`t.Cleanup()` over manual deferred teardown** inside test helpers,
  especially for anything opened via `t.TempDir()`-adjacent resources (DB
  handles, temp files not already covered by `t.TempDir()`).
- **Race detector in CI** (`go test -race ./...`) is the actual test for any
  concurrency claim in this lens's HIGH section above — a review finding
  about a data race is unverified until this has run.
- **Coverage targets**: 100% critical business logic, 90%+ public API, 80%+
  general code, generated code excluded — same shape as the general skill's
  Domain 5 targets, stated here only because Go's `go test -cover` /
  `go tool cover -func` commands are the concrete way to check it for this
  stack.

---

## False-positive traps

- `_ = err` on `Close()`/`Flush()` calls in a deferred cleanup where the
  operation is explicitly best-effort and the real error was already
  surfaced by the primary operation is a documented convention, not a
  finding — check for a comment or an established pattern in the file
  before flagging.
- A single-method interface defined in the provider package is not
  automatically "interface pollution" if the whole package genuinely has
  one consumer and that consumer is co-located (e.g. a small internal
  package) — the finding is about interfaces that force unrelated
  implementations to satisfy unused methods, not every provider-side
  interface.
- Mixed value/pointer receivers where every value-receiver method is
  read-only and documented as intentionally cheap-to-copy is a deliberate
  design choice, not an inconsistency bug — check for a comment before
  flagging.
- `panic()` inside `func init()` or at genuine programmer-error boundaries
  (a required dependency literally cannot be nil at startup) is idiomatic,
  not a control-flow misuse.

## Escalate to general domain when…

- The finding is generic SQL/command/path injection with no Go-specific
  nuance (e.g. `exec.Command("sh", "-c", userInput)`) — that's the general
  skill's SEC domain; flag it there, note the Go-specific API name only.
- The finding is about test coverage percentage or test *quality* beyond
  Go-specific mechanics (assertion style, missing edge cases) — that's
  Domain 5 (`test-quality-lens.md`) in the general skill.
- A performance claim needs a benchmark to confirm (not just "this
  allocates too much") — escalate to `performance-audit-edho-ferdian`
  and ask for `go test -bench=. -benchmem` output before asserting it.
