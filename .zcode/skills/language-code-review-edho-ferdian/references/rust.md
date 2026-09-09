# Language Lens — Rust

**FOLD-M.** Kelompok 1 lanjutan: konten sedang, plausibel dari sumbernya,
tapi **belum ada bukti proyek Rust aktif** di workspace Edho saat ini — beda
dari lens Python/React (FOLD-P) yang sudah dipakai pada proyek nyata di
ekosistem ini. Perlakukan file ini sebagai lens siap-pakai begitu proyek
Rust muncul, bukan sebagai sesuatu yang sudah tervalidasi lapangan.

**Detect.** A `Cargo.toml` at repo root, or any `.rs` file in review scope.

**Boundary — read before flagging anything.** Generic injection, generic
secret handling, generic function-length/nesting/magic-number checks, and
generic N+1 detection are **already owned by `references/review-checklist.md`**
in the general skill. This lens adds only what is specific to **Rust's
ownership model, error-handling conventions, and unsafe-code discipline** —
patterns that compile cleanly (the borrow checker doesn't reject them) but
are still bad design, plus the language's own idioms around `Result`/`?`.

**Code placement.** Findings land as **CQ-12 (Rust ownership/idiom
anti-patterns)** in the general report. Rust-specific security items (unsafe
FFI boundaries without validated invariants, unchecked `transmute`) belong to
`security-review-edho-ferdian/references/language-specific.md` when that
file covers Rust; until then, flag unsafe-without-justification here under
CRITICAL as an exception (see below) since it is a memory-safety concern the
general skill has no other lens for yet.

---

## Ground-truth commands

```bash
cargo check                    # fast type/borrow check without codegen
cargo build                    # full compile — confirms type findings
cargo clippy -- -D warnings    # the actual source of most idiom findings below
cargo fmt --check              # format check
cargo test                     # confirms behavior, not ownership design quality
cargo audit                    # dependency vulnerability scan
cargo tree -d                  # duplicate/conflicting dependency versions
```

Do not label a clippy-detectable finding (needless clone, redundant closure,
inefficient collect) as [High confidence] without having actually run
`cargo clippy` — recognizing the pattern by eye is reasoning, not
verification, per the general skill's Phase 2 rule. `cargo clippy` catches
most of the MEDIUM section below directly; findings it would flag get
[High confidence] once run, others stay capped at [Medium].

---

## Lens criteria

### CRITICAL

- **`unsafe` block with no `// SAFETY:` comment justifying the invariant
  being upheld** — Rust's whole safety guarantee is void inside `unsafe`;
  an unjustified block means neither the author nor the reviewer can verify
  the invariant holds. Every `unsafe` block needs a comment stating exactly
  why the operation is sound at that call site (valid pointer, correct
  alignment, non-overlapping lifetimes, etc.). **CQ-12.**
- **`unsafe` used to bypass the borrow checker for convenience** (not for a
  genuine FFI boundary or a proven, benchmarked hot path) — this defeats
  the entire point of Rust; the fix is almost always `Rc<RefCell<T>>`,
  `Arc<Mutex<T>>`, or restructuring ownership, not `unsafe`. **CQ-12.**
- **`transmute` between unrelated or size-mismatched types** — undefined
  behavior if the layouts don't actually match; flag any `transmute` that
  isn't between types with a documented, verified identical memory layout.
  **CQ-12.**

### HIGH

- **`.unwrap()` or `.expect()` on a fallible operation in non-test,
  non-genuinely-infallible code path** — panics the whole process/thread on
  the error branch instead of propagating it with `?`. Acceptable only in
  tests, in a `main()` top-level boundary that intentionally exits on
  startup failure (and even then `?`-with-`anyhow` in `main() -> Result<()>`
  is preferred), or where the value is *provably* always `Some`/`Ok` at that
  point (state that proof in a comment, otherwise it's still a finding).
  **CQ-12.**
- **`Result`/`Option` silently discarded** — `let _ = fallible_call();` or a
  function call whose `#[must_use]` return value is dropped without
  handling. The compiler warns on this for stdlib `Result`, but a custom
  `Result`-returning function without `#[must_use]` slips through silently.
  **CQ-12.**
- **Ownership/borrow pattern that compiles but signals a design smell** —
  e.g. `.clone()` used repeatedly to "make the borrow checker happy" instead
  of restructuring so a reference or a different lifetime shape suffices.
  This compiles fine; it is a design-quality finding, not a compiler error,
  which is exactly why it needs a human/lens reviewer rather than `cargo
  check`. **CQ-12.**
- **Wildcard `_ =>` arm on an exhaustive match over a business-logic enum**
  — hides the compiler's guarantee that adding a new variant forces every
  call site to handle it. A catch-all on a config/external enum is fine; on
  an internal enum modeling your own domain states, it's a latent bug
  waiting for the next variant. **CQ-12.**
- **`Box<dyn std::error::Error>` as a library's public error type** instead
  of a `thiserror`-derived enum — callers lose the ability to match on
  specific error variants with `errors.Is`/`downcast`-equivalent ergonomics.
  Acceptable in application code (where `anyhow::Error` is the idiomatic
  choice); a HIGH finding specifically in library/crate code meant for
  external consumers. **CQ-12.**

### MEDIUM

- **Cloning a large structure only to satisfy the borrow checker**, where a
  reference, `Cow<'_, T>`, or a scope restructure would avoid the
  allocation — flag with the specific alternative, not just "avoid clone."
  **CQ-12.**
- **`String` parameter where `&str` would suffice** (the function never
  needs ownership) — forces every caller to allocate or clone unnecessarily.
  **CQ-12.**
- **Manual accumulation loop where an iterator chain (`.filter().map()
  .collect()`) is clearer** — flag only when the chain form is genuinely
  more readable, not as a blanket style preference. **CQ-12.**
- **Primitive obsession** — a bare `u64`/`String` used for a domain concept
  that would benefit from a newtype (`UserId(u64)`, `Email(String)`) to
  prevent argument-order mix-ups at call sites with multiple same-typed
  parameters. **CQ-12.**
- **Blocking call inside an `async fn`** — `std::thread::sleep`,
  synchronous file I/O, or a CPU-bound loop with no `.await` yield point
  inside an async function blocks the entire executor thread, starving
  every other task scheduled on it. Use `tokio::time::sleep(...).await` or
  `tokio::task::spawn_blocking` for genuinely blocking work. **CQ-12.**
- **Making everything `pub`** instead of `pub(crate)` for internals — widens
  the crate's public API surface (and its semver-breaking-change risk)
  beyond what's actually needed by external consumers. **CQ-12.**
- **A public trait meant to be used but not implemented downstream, missing
  the sealed-trait pattern** — a public trait with a private supertrait
  (`pub trait Foo: private::Sealed { ... }` where `private::Sealed` lives in
  a non-`pub` module) lets the crate expose the trait for callers to use
  while blocking external `impl` blocks, so the owner can still add methods
  in a minor version without it being a breaking change for anyone outside
  the crate. Flag a public trait that clearly wants this guarantee (an enum-
  like closed set of implementors, or doc comments saying "do not implement
  this yourself") but exposes an open supertrait instead, letting any
  downstream crate implement it and lock the owner out of ever adding a
  method. **CQ-12.**

---

## Testing lens (from `rust-testing`)

- **Unit tests in a `#[cfg(test)] mod tests` block co-located with the code**
  is the default; integration tests belong in `tests/` as separate binaries
  that only exercise the crate's public API.
- **`assert_eq!` over `assert!(a == b)`** wherever an equality check is being
  made — the failure message shows both values, not just "assertion
  failed."
- **`#[should_panic]` overused where `Result::is_err()` would be clearer** —
  `should_panic` can't assert *why* the code failed beyond a substring match
  on the panic message; prefer returning `Result` from the function under
  test and asserting on the specific error variant.
- **Property-based tests (`proptest`) missing for parsers/serializers/
  codecs** — round-trip properties (`decode(encode(x)) == x`) catch classes
  of bugs example-based tests miss entirely; flag their absence only for
  code that has an obvious round-trip or invariant property, not
  universally.
- **Mocking via `mockall` used where an integration test with the real
  dependency would be more valuable** — the general skill's `test-quality-
  lens.md` already owns "mock everything" as an anti-pattern; this note is
  Rust-specific only in that `#[automock]` makes over-mocking unusually easy
  to reach for.
- **Coverage via `cargo-llvm-cov`**, same targets as the general skill's
  Domain 5 (100% critical logic, 90%+ public API, 80%+ general, generated/
  FFI bindings excluded).

---

## False-positive traps

- `.unwrap()` in a `#[test]` function or in `examples/` is normal — tests
  and examples are expected to fail loudly on unexpected state, not to
  demonstrate production error handling.
- `.clone()` on a small, `Copy`-cheap-adjacent type (a `String` under a few
  bytes, a small `Vec` known to stay tiny) inside a hot path that isn't
  actually hot (no profiling evidence) is a style nit at most — don't cap
  it above MEDIUM without a benchmark.
- A wildcard `_ =>` arm on a `match` over a genuinely external/foreign enum
  (from a crate you don't control, which can add variants without a
  semver-major bump) is often the *correct* defensive choice, not a
  shortcut — the finding is about internal domain enums only.
- `unsafe` inside a `//! SAFETY:`-documented FFI wrapper module with a
  clear, testable invariant is the acceptable case the pattern file itself
  calls out — don't flag it as CRITICAL just because it's `unsafe`; verify
  the safety comment actually exists and is specific before flagging.

## Escalate to general domain when…

- The finding is generic injection/secret-handling with no Rust-specific
  nuance — that's the general skill's SEC domain.
- The finding is about test coverage percentage rather than Rust-specific
  test mechanics — Domain 5 (`test-quality-lens.md`).
- A performance claim needs `cargo bench`/Criterion evidence to confirm —
  escalate to `performance-audit-edho-ferdian` rather than asserting from
  code reading alone.
