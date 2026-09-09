# Rust — cargo build, borrow checker & dependency resolution lens

**FOLD-M.** Kelompok 1 lanjutan: konten sedang, plausibel,
tapi **belum ada bukti proyek Rust aktif** di workspace Edho saat ini — beda
dari lens JavaScript/TypeScript dan Django/Python (FOLD-P) yang sudah
dipakai pada proyek nyata di ekosistem ini. Perlakukan file ini sebagai
diagnostic lens siap-pakai begitu proyek Rust muncul, bukan sebagai sesuatu
yang sudah tervalidasi lapangan.

Scope: `cargo build`/`cargo check` failures — borrow checker errors,
lifetime errors, unsatisfied trait bounds, and `Cargo.toml` dependency
version conflicts. You fix the error only — you do not restructure
ownership architecture or change public APIs beyond what the error demands.

## Diagnostic commands

Run these in order to localize the error before touching anything:

```bash
# Confirm toolchain
rustc --version
cargo --version

# Fast check without full codegen — the primary reproduction command
cargo check

# Full build if check passes but build still fails (rare — codegen-only issues)
cargo build

# Additional lint-level findings that are sometimes the actual root cause
cargo clippy

# Dependency graph state
cargo tree
cargo metadata --format-version 1 > /dev/null   # validates Cargo.toml/Cargo.lock parse cleanly
```

## Resolution workflow

```
1. Reproduce the error            -> capture the FULL rustc diagnostic, unedited
                                      (rustc's error messages already suggest fixes —
                                      read the whole message, including "help:" and
                                      "note:" lines, before doing anything else)
2. Identify the error family      -> use the tables below
3. Read the affected file         -> understand ownership/lifetime context before editing
4. Apply the minimal fix          -> only what the error demands
5. cargo check                    -> confirm the specific error is gone
6. cargo build && cargo test      -> confirm nothing else broke
```

**Read the compiler's own suggestion first.** Rust's diagnostics routinely
include a `help:` line with the exact fix (add a lifetime, borrow instead of
move, derive a trait). Applying that suggestion verbatim is often correct —
but still read the surrounding code before applying it, since the suggested
fix can occasionally paper over a design issue (see Anti-suppression
reminders below).

## Borrow checker errors

| Error | Cause | Fix |
|---|---|---|
| `cannot borrow \`x\` as mutable because it is also borrowed as immutable` | An immutable borrow of `x` is still in scope (often held longer than it looks — NLL doesn't help if the borrow is used later) | Shrink the immutable borrow's scope (end it before the mutable borrow starts), or restructure so both aren't needed simultaneously |
| `cannot move out of \`x\` because it is borrowed` | Attempting to move a value while a reference to it is still live | Clone if genuinely needed (and justify why), or restructure so the move happens after the borrow ends |
| `use of moved value: \`x\`` | `x` was moved (e.g. passed by value, or captured by a closure that takes ownership) and then used again afterward | Pass by reference instead if the second use only needs to read it; clone only if two independent owners are genuinely required |
| `cannot borrow \`x\` as mutable more than once at a time` | Two `&mut` borrows of the same value overlap | Sequence them so one ends before the other starts, or split `x` into separate fields borrowed independently (Rust allows disjoint field borrows) |
| `borrow of moved value` (closures) | A closure moved a captured variable, and the same variable is used again outside the closure | Add `move` deliberately only if ownership transfer is intended; otherwise capture by reference (drop `move`, or clone before the closure if a second independent copy is truly needed) |

```bash
# Explain a specific error code in full detail, including a longer example
rustc --explain E0502
```

## Lifetime errors

| Error | Cause | Fix |
|---|---|---|
| `\`x\` does not live long enough` | A reference outlives the value it points to (the value is dropped while a reference to it is still expected to be valid) | Extend the value's lifetime to cover every use of the reference (often means returning an owned value instead of a reference, or restructuring scope) — never "fix" this by adding `'static` unless the value is genuinely static |
| `missing lifetime specifier` | A function signature returns a reference and the compiler can't infer which input lifetime it's tied to | Add the explicit lifetime parameter connecting the output reference to the correct input (`fn f<'a>(x: &'a str) -> &'a str`) |
| `lifetime may not live long enough` (generic/trait context) | A generic type parameter's implicit lifetime bound doesn't satisfy what a trait or struct requires | Add the explicit bound the compiler names (`T: 'a`) rather than reaching for `'static` as a blanket fix |
| `cannot infer an appropriate lifetime` | Ambiguous relationship between multiple reference parameters | Name the lifetimes explicitly instead of relying on elision when there's more than one plausible input lifetime |

**`'static` is not a generic fix for a lifetime error.** Slapping `'static`
on a struct field or bound to make an error disappear usually just moves the
error to every caller that can't actually provide a `'static` reference, or
silently forces an unnecessary `.clone()`/`Box::leak()` elsewhere. Read what
the compiler is actually asking for before reaching for it.

## Trait bound errors

| Error | Cause | Fix |
|---|---|---|
| `the trait bound \`T: Trait\` is not satisfied` | The concrete type used doesn't implement the required trait | Either implement the trait for the type (if you own it), wrap it in a newtype that does, or relax the bound if the trait usage wasn't actually necessary |
| `the trait \`Trait\` is not implemented for \`&T\`` (or `&mut T`) | A blanket impl exists for `T` but not for the reference type, or vice versa | Check whether the call site needs to dereference first, or whether the trait needs `impl Trait for &T` as well |
| `type annotations needed` | Type inference can't resolve a generic parameter (common with `.collect()`, `.parse()`) | Add an explicit type annotation or turbofish (`.collect::<Vec<_>>()`) at the ambiguous call site |
| `method not found for type T` | The trait providing that method isn't in scope (Rust requires importing a trait to call its methods) | Add the `use` for the trait, not necessarily for the type — this is a common false alarm for library users unfamiliar with Rust's trait-import requirement |
| `conflicting implementations of trait` | Two impls both apply to the same type (often an orphan-rule-adjacent overlap) | Remove the redundant impl, or use a newtype wrapper to disambiguate |

```bash
rustc --explain E0277   # trait bound not satisfied, most common trait error
rustc --explain E0308   # mismatched types
```

## Dependency resolution (`Cargo.toml` / `Cargo.lock`)

| Error | Cause | Fix |
|---|---|---|
| `failed to select a version for \`crate\`` | Two dependencies require incompatible version ranges of the same crate | `cargo tree -i -p crate-name` to find every requirer, then relax the tightest constraint (usually your own `Cargo.toml`, not a transitive dependency you don't control) |
| `error: no matching package named \`X\` found` | Wrong crate name, or a version that doesn't exist on crates.io | Check the exact name/version on crates.io; typos in `Cargo.toml` are the most common cause |
| `multiple versions of crate X are being pulled in` (via `cargo tree -d`) | Different dependencies pin incompatible major versions of a shared crate — not always an error, but a real bloat/behavior-fragmentation risk | Pin a single compatible version across your own direct dependencies where possible; a transitive multi-version situation caused entirely by third-party crates isn't fixable from your `Cargo.toml` alone |
| `Cargo.lock` out of sync with `Cargo.toml` | `Cargo.toml` was edited by hand without regenerating the lockfile | `cargo update -p crate-name` (targeted) rather than a blanket `cargo update` that bumps every dependency at once |
| `edition2021 (or newer) feature ... requires ...` | `Cargo.toml`'s `edition` is older than a feature the code uses | Confirm with the user before bumping `edition` — an edition bump is a project-wide semantic change, not a narrow build fix |

```bash
cargo tree -i -p crate-name    # who depends on this crate, and at what version
cargo update -p crate-name     # bump one dependency's resolved version, not everything
cargo update -p crate-name --precise x.y.z   # pin to an exact version
```

## Anti-suppression reminders specific to this stack

- Never reach for `.clone()` purely to make a borrow-checker error
  disappear without first checking whether a reference or a scope
  restructure would work — a clone silences the compiler but can hide a
  real ownership design problem (see the review lens's HIGH section on this
  exact pattern).
- Never add `'static` as a default fix for a lifetime error — read what
  lifetime the compiler is actually asking for.
- Never bump a crate's major version (or the `edition` field) to resolve a
  trait-bound or dependency conflict without flagging it to the user first
  — that's an architectural/scope decision, not a build fix, even when it
  "just works."
- Never silence an unused-`Result` warning with `let _ = call();` as the
  fix for a compile *warning* that was actually pointing at a real bug —
  handle the `Result`, don't discard it to quiet the compiler.
