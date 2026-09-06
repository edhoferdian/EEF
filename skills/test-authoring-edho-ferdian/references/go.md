# Go — Authoring Guide

Adapted from ECC `golang-testing`, fetched 2026-09-07 (skill), cross-checked
against ECC `rules/golang/testing.md`.

This is stack-specific detail for `test-authoring-edho-ferdian`'s SKILL.md.
Read the SKILL.md first for the three-way boundary against
`code-review-edho-ferdian`'s test-quality-lens, `dev-kickoff-edho-ferdian`'s
test-design-checklist, and `e2e-testing-edho-ferdian` — this file assumes
that boundary and only covers Go-specific authoring mechanics.

---

## Table-driven tests — the standard Go pattern

This is the idiomatic default for any function with more than one
meaningful input case. Reach for it before writing several near-duplicate
`TestX_CaseY` functions:

```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive numbers", 2, 3, 5},
        {"negative numbers", -1, -2, -3},
        {"zero values", 0, 0, 0},
        {"mixed signs", -1, 1, 0},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := Add(tt.a, tt.b)
            if got != tt.expected {
                t.Errorf("Add(%d, %d) = %d; want %d", tt.a, tt.b, got, tt.expected)
            }
        })
    }
}
```

Apply the stack-agnostic edge-case categories from
`dev-kickoff-edho-ferdian/references/test-design-checklist.md` to decide
which rows belong in the table — the table-driven pattern is the Go
mechanism, the checklist is what decides *which* cases to include.

### Error-case rows in the same table

Include the error path as rows in the same table rather than a separate
test function, when the function under test has one signature that returns
`(value, error)` for both paths — keeps success and failure cases visibly
side by side instead of drifting apart over time:

```go
func TestParseConfig(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    *Config
        wantErr bool
    }{
        {name: "valid config", input: `{"host":"localhost","port":8080}`, want: &Config{Host: "localhost", Port: 8080}},
        {name: "invalid JSON", input: `{invalid}`, wantErr: true},
        {name: "empty input", input: "", wantErr: true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := ParseConfig(tt.input)

            if tt.wantErr {
                if err == nil {
                    t.Error("expected error, got nil")
                }
                return
            }
            if err != nil {
                t.Fatalf("unexpected error: %v", err)
            }
            if !reflect.DeepEqual(got, tt.want) {
                t.Errorf("ParseConfig() = %+v; want %+v", got, tt.want)
            }
        })
    }
}
```

`t.Fatalf` (stops the subtest immediately) vs `t.Errorf` (records the
failure, keeps running): use `Fatalf` once a wrong result would make later
assertions in the same subtest meaningless or panic (e.g. dereferencing a
nil pointer that shouldn't be nil if `err != nil` was already false) — use
`Errorf` when later assertions in the same subtest are still independently
useful even after this one fails.

---

## Subtests: `t.Run` beyond table-driven loops

`t.Run` isn't only for the table-driven loop body — it also groups related
assertions under one parent test so a failure report names exactly which
sub-case failed (`TestParseConfig/invalid_JSON` in `go test -v` output),
and subtests can be filtered individually:

```bash
go test -run TestParseConfig/invalid_JSON -v
```

Each `t.Run` subtest gets its own pass/fail and its own `t.Parallel()`
opt-in (see below) — this is what makes table-driven tests report
per-case instead of failing the whole table opaquely on the first bad row.

### Parallel subtests — the loop-variable capture trap

```go
func TestParallelCases(t *testing.T) {
    tests := []struct{ name string; input int }{
        {"case1", 1}, {"case2", 2}, {"case3", 3},
    }
    for _, tt := range tests {
        tt := tt // capture for Go < 1.22 — see note below
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            // use tt.input
        })
    }
}
```

On Go versions before 1.22, the loop variable `tt` is reused across
iterations, so a `t.Parallel()` subtest closure that captures `tt` directly
(without the `tt := tt` shadow) can run with the *last* iteration's value
instead of the one it was meant to test — a classic source of a
table-driven test that passes locally in whatever order but fails
intermittently or asserts the wrong case under `-race`/parallel execution.
Go 1.22+ changed loop variable semantics so each iteration gets its own
variable, making the `tt := tt` shadow unnecessary — but don't assume the
project's Go version without checking `go.mod`'s `go` directive first.

---

## Mocking via interfaces

Go has no built-in mocking framework in the standard library; the idiomatic
approach is to depend on an interface, not a concrete type, and substitute a
hand-written or generated fake in tests:

```go
type UserRepository interface {
    FindByID(id int) (*User, error)
    Save(u *User) error
}

type stubUserRepository struct {
    findByIDFunc func(id int) (*User, error)
    saveFunc     func(u *User) error
}

func (s *stubUserRepository) FindByID(id int) (*User, error) { return s.findByIDFunc(id) }
func (s *stubUserRepository) Save(u *User) error              { return s.saveFunc(u) }

func TestUserService_CreateUser(t *testing.T) {
    repo := &stubUserRepository{
        saveFunc: func(u *User) error {
            if u.Name != "Alice" {
                t.Errorf("expected Name=Alice, got %s", u.Name)
            }
            return nil
        },
    }
    service := NewUserService(repo)

    user, err := service.CreateUser("Alice")

    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
    if user.Name != "Alice" {
        t.Errorf("got %s; want Alice", user.Name)
    }
}
```

A hand-written stub like this (a struct holding a func field per method) is
often enough for a small interface and keeps the test dependency-free. For
a larger interface or a project that already uses one, `gomock`
(`mockgen`) or `testify/mock` generate this boilerplate instead of hand-
writing it:

```go
//go:generate mockgen -source=repository.go -destination=mock_repository.go -package=mocks
```

Prefer generating from the interface's own source file so the mock stays in
sync with the interface automatically on regeneration, rather than hand-
maintaining a mock that can silently drift out of sync with a changed
interface signature.

---

## testify vs. stdlib `testing`

Stdlib `testing` (`t.Errorf`, `t.Fatalf`, manual `if got != want` checks) is
sufficient and is what every example above uses — it has zero dependencies
and is what most Go style guides (including Go's own team) recommend as the
default.

`testify` (`assert`/`require` packages) trades that zero-dependency
simplicity for more expressive, less boilerplate-heavy assertions:

```go
import "github.com/stretchr/testify/require"

func TestAdd(t *testing.T) {
    require.Equal(t, 5, Add(2, 3))
}
```

- `assert.*` records a failure and keeps the test running (like `t.Errorf`);
  `require.*` stops the test immediately on failure (like `t.Fatalf`). Use
  `require` for a precondition the rest of the test depends on (e.g. "the
  setup call didn't error") and `assert` for independent final checks so
  one wrong assertion doesn't hide the next.
- `testify/mock` provides a more feature-rich mock object (call-count
  assertions, argument matchers, return-value stubbing) than a hand-written
  stub, at the cost of a reflection-based API that's less type-safe than a
  hand-written interface implementation.
- Neither is "more correct" — pick based on what the project already uses;
  don't introduce `testify` into a stdlib-only codebase for a single test
  file, and don't hand-roll verbose stdlib assertions in a codebase that
  already has `testify` as a dependency everywhere else.

---

## Benchmark tests

```go
func BenchmarkProcess(b *testing.B) {
    for i := 0; i < b.N; i++ {
        Process(sampleInput)
    }
}
```

```bash
go test -bench=BenchmarkProcess -benchmem
# BenchmarkProcess-8   10000   105234 ns/op   4096 B/op   10 allocs/op
```

- `b.N` is chosen by the testing framework, adjusted automatically until the
  benchmark runs long enough to produce a stable measurement — never
  hardcode a loop count instead of using `b.N`.
- `-benchmem` reports allocations per operation alongside timing — often
  more actionable than the raw `ns/op` number, since allocation count is
  frequently the actual lever (reducing allocations often reduces GC
  pressure and wall time together).
- Reset the timer after any per-benchmark setup that shouldn't count toward
  the measurement:
  ```go
  func BenchmarkSortLargeSlice(b *testing.B) {
      data := generateLargeSlice()
      b.ResetTimer()
      for i := 0; i < b.N; i++ {
          Sort(data)
      }
  }
  ```
  Without `b.ResetTimer()`, `generateLargeSlice()`'s cost is folded into
  every reported `ns/op`, understating the actual function's relative
  improvement or regression between runs.
- A benchmark is a measurement, not a pass/fail test — same discipline as
  `performance-audit-edho-ferdian`'s baselines: persist the output and
  compare against a prior committed baseline (`benchstat` compares two
  benchmark runs statistically) rather than eyeballing a single run's
  absolute number.

---

## Test coverage

```bash
go test -cover ./...
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out   # visual, line-by-line coverage report
```

Apply the same 80% floor and qualifications from
`baseline-testing-standards.md` — Go's coverage tool reports line coverage
only, which (same caveat as everywhere else) doesn't distinguish a
meaningfully-asserted line from one merely executed by a table-driven case
whose assertion is trivial.

---

## Anti-patterns to avoid

- Capturing a table-driven loop variable directly inside a `t.Parallel()`
  subtest closure on a project targeting Go < 1.22 without the `tt := tt`
  shadow — see the loop-variable capture trap above.
- Testing an unexported implementation detail directly instead of the
  exported behavior it supports — same "test behavior, not internals"
  principle as every other stack in this skill.
- A hand-rolled mock/stub whose behavior silently diverges from the real
  interface it stands in for (missing a method the interface added later,
  since Go's structural typing won't catch a stub that implements an old
  version of an interface until it's actually used as that interface) —
  prefer a generated mock (`mockgen`) once an interface is large enough
  that this drift risk is real.
- Ignoring a benchmark's own setup cost by not calling `b.ResetTimer()`.
- Mixing `assert` and `require` inconsistently in the same test in a way
  that lets execution continue past a failed precondition into assertions
  that then panic (nil dereference) instead of failing cleanly — use
  `require` for anything the rest of the test body dereferences or depends
  on structurally.

## Provenance

Adapted from ECC `skills/golang-testing/SKILL.md` and
`rules/golang/testing.md`, fetched 2026-09-07. The Go 1.22 loop-variable
semantics note, the `t.Fatalf` vs `t.Errorf` decision rule, and the
testify-vs-stdlib tradeoff framing extend that source content for this
ecosystem's authoring-craft framing.
