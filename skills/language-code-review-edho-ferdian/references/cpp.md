# Language Lens — C++

**FOLD-M.** Content is medium-depth and plausible, drawing on the
C++ Core Guidelines-derived coding-standards
material, but **there is no evidence of an active C++ project in Edho's
workspace yet** — unlike Angular/NestJS (verified against `ghostfolio`) or
Python/React (already exercised elsewhere in this ecosystem). Treat this
file as a ready-to-use lens the moment a matching C++ project shows up, not
as field-validated. Written ahead of its original DEFER trigger ("a real
C++ project appears") per the backlog-removal decision.

**Detect.** A `CMakeLists.txt` at repo root, or any `.cpp`/`.hpp`/`.cc`/
`.hh`/`.cxx`/`.h` file in review scope.

**Boundary — read before flagging anything.** Generic injection, generic
secret handling, generic function-length/nesting/magic-number checks, and
generic N+1 detection are **already owned by `references/review-checklist.md`**
in the general skill. This lens adds only what is specific to **C++'s manual
memory model, RAII/ownership discipline, and concurrency primitives** —
patterns that compile cleanly (there is no borrow checker to reject them)
but are still memory-unsafe or design-unsound, per the C++ Core Guidelines
(isocpp.github.io/CppCoreGuidelines) this lens's coding-standards material
is itself derived from.

**Code placement.** Findings land as **CQ-14 (C++ memory-safety/RAII/
concurrency anti-patterns)** in the general report. C++-specific security
items (unchecked buffer operations, format-string injection via
user-controlled `printf` format strings, unsafe `system()`/`popen()` calls)
belong to `security-review-edho-ferdian/references/language-specific.md`
once that file covers C++; until then, flag raw memory-safety violations
(buffer overflow, use-after-free, uninitialized read) here under CRITICAL as
an exception (see below) — the same precedent `rust.md` sets for
unsafe-without-justification, since C++ memory-safety bugs are the language's
single largest CVE category and the general skill has no other lens for it
yet.

---

## Ground-truth commands

```bash
cmake --build build 2>&1 | head -100                            # confirms the code actually compiles
clang-tidy --checks='*,-llvmlibc-*' src/*.cpp -- -std=c++17      # the actual source of most idiom findings below
cppcheck --enable=all --suppress=missingIncludeSystem src/       # static analysis, different rule set than clang-tidy
cmake --build build --target format-check 2>/dev/null || clang-format --dry-run --Werror src/*.cpp
ctest --test-dir build --output-on-failure                       # confirms behavior, not memory-safety design
# Sanitizer builds (see build-fix-edho-ferdian/references/cpp.md for enabling them) confirm
# use-after-free / data-race findings far more reliably than reading code:
#   cmake -B build-asan -DENABLE_ASAN=ON && cmake --build build-asan && ctest --test-dir build-asan
```

Do not label a clang-tidy/cppcheck-detectable finding (a missing
`const`, a raw `new`, a narrowing conversion) as [High confidence] without
having actually run the tool — recognizing the pattern by eye is reasoning,
not verification, per the general skill's Phase 2 rule. A genuine
use-after-free or data race claim should ideally be backed by an ASan/TSan
run, not just static reading of the code — cap at [Medium confidence] when
that verification wasn't run, per the general skill's confidence-floor rule.

---

## Lens criteria

### CRITICAL

- **Raw `new`/`delete` instead of RAII** (`std::unique_ptr`,
  `std::shared_ptr`, or a scoped/stack object) — every manual
  allocation/deallocation pair is a leak or double-free waiting for an
  exception, an early return, or a future edit to break the pairing.
  R.10/R.11 of the Core Guidelines. **CQ-14.**
- **Use-after-free / dangling reference or iterator** — returning a
  reference/pointer to a local, holding an iterator across a container
  mutation that invalidates it, or using an object after it's been moved
  from without reassignment. **CQ-14.**
- **Buffer overflow risk**: C-style arrays with unchecked indexing,
  `strcpy`/`sprintf`/`gets` without a bounds-safe variant, or a `memcpy`
  whose size argument isn't provably bounded by both buffers' actual sizes.
  **CQ-14.**
- **Uninitialized variable read** — a variable declared without an
  initializer and read before any assignment reaches it on some code path;
  ES.20's "always initialize" exists precisely because C++ does not
  guarantee zero-initialization for local variables of built-in/POD type.
  **CQ-14.**
- **Data race**: shared mutable state accessed from more than one thread
  without a mutex, atomic, or other synchronization primitive — verify with
  ThreadSanitizer before asserting [High confidence]; reading code alone
  can miss a race that only manifests under specific interleavings.
  **CQ-14.**
- **`reinterpret_cast` or C-style cast without a stated justification** —
  both bypass the type system's safety guarantees; a C-style cast is worse
  because it silently picks whichever of `static_cast`/`const_cast`/
  `reinterpret_cast` compiles, hiding which one is actually happening.
  **CQ-14.**

### HIGH

- **Rule of Five violated** — a class defines/deletes one of destructor,
  copy constructor, copy assignment, move constructor, or move assignment
  without handling all five consistently (C.21) — the compiler-generated
  members left unaddressed can silently do the wrong thing (a shallow copy
  of an owning raw pointer, for instance). Prefer Rule of Zero (C.20) when
  the class can avoid owning a resource directly at all. **CQ-14.**
- **Unnamed lock guard**: `std::lock_guard<std::mutex>(m);` constructs a
  temporary that is destroyed immediately at the end of the statement,
  releasing the lock before the code it was meant to protect even runs —
  CP.44's "name your lock guards" exists because this compiles silently and
  produces no protection at all. **CQ-14.**
- **Multiple mutexes locked without `std::scoped_lock`** — locking two or
  more mutexes individually (even with `lock_guard` on each) in
  inconsistent order across call sites is a deadlock waiting for the right
  interleaving; `std::scoped_lock(m1, m2)` locks all of them atomically
  with deadlock avoidance built in (CP.21). **CQ-14.**
- **Detached thread (`std::thread` neither `join()`-ed nor explicitly
  `detach()`-ed before the `std::thread` object is destroyed)** — an
  unhandled `std::thread` destructor with a still-joinable thread calls
  `std::terminate()`; an explicitly `detach()`-ed thread with no lifetime
  tracking makes shutdown/cleanup ordering nearly impossible to reason
  about (CP.26). **CQ-14.**
- **Missing `virtual` destructor on a polymorphic base class** — deleting a
  derived object through a base pointer without a virtual destructor is
  undefined behavior; only the base's destructor runs, leaking any
  derived-class resources (C.35). **CQ-14.**
- **Calling a virtual function from a constructor or destructor** — during
  construction/destruction the dynamic type is the class currently being
  constructed/destructed, not the most-derived type, so this never
  dispatches the way the author likely intended (C.82). **CQ-14.**

### MEDIUM

- **Unnecessary copy**: a large object (a `std::string`, a `std::vector`, a
  user-defined aggregate) passed by value where `const&` would avoid the
  copy, or copied into a member instead of moved when the source is a
  temporary/rvalue (F.16, missing `std::move` on a sink parameter).
  **CQ-14.**
- **Missing `reserve()`** on a `std::vector` whose final size is known or
  computable ahead of the fill loop — without it, growth triggers repeated
  reallocation and copying. **CQ-14.**
- **`const` correctness gaps** — a member function that doesn't mutate
  state missing `const`, or a parameter/reference that could be `const&`
  left as a plain mutable reference (Con.2, Con.3). **CQ-14.**
- **Plain `enum` instead of `enum class`** — unscoped enumerators leak
  their names into the surrounding scope and implicitly convert to `int`,
  both of which `enum class` (Enum.3) exists to prevent. **CQ-14.**
- **`using namespace std;` at global/header scope** — pollutes every
  translation unit that includes the header with the entire `std`
  namespace, and can silently change overload resolution as the standard
  library evolves (SF.7). Fine inside a narrow function-local scope in a
  `.cpp` file; a finding specifically when it appears in a header or at
  global namespace scope. **CQ-14.**
- **Magic numbers without a named constant** — an unexplained numeric
  literal controlling a loop bound, buffer size, or threshold (ES.45).
  **CQ-14.**
- **`std::endl` instead of `'\n'`** in a hot output path — `endl` forces a
  stream flush on every call, which is a measurable cost in a tight loop
  (SL.io.50); a MEDIUM finding, not CRITICAL, since it's a performance nit
  rather than a correctness bug. **CQ-14.**

---

## Testing lens (from `cpp-testing`)

- **GoogleTest/GoogleMock (`gtest`/`gmock`) with CMake/CTest** is
  this ecosystem's default C++ stack — flag a project missing
  `gtest_discover_tests()` in favor of manually listing test names in
  `CMakeLists.txt`, which silently drops newly-added tests from CTest's
  view until someone remembers to add them.
- **Sleep-based synchronization in a concurrency test** (`std::this_
  thread::sleep_for` used to "wait for the other thread to finish")
  instead of a condition variable, latch, or future/promise — the classic
  source of flaky C++ concurrency tests; the fix is always a real
  synchronization primitive, never a longer sleep.
- **Fixed/shared temp file or directory paths across tests** instead of a
  unique per-test path with guaranteed cleanup — a common source of
  test-order-dependent flakiness in C++ test suites that touch the
  filesystem.
- **Missing sanitizer builds in CI** (ASan/UBSan/TSan) — for memory-unsafe
  code, sanitizer runs catch classes of bugs (use-after-free, data races)
  that GoogleTest's assertions alone structurally cannot detect; flag their
  absence specifically when the review scope includes raw pointers, manual
  memory management, or multi-threaded code.
- **Over-mocking a stateful dependency** with `gmock` where a fake (a
  simple in-memory implementation) would exercise more real behavior — the
  general skill's `test-quality-lens.md` already owns "mock everything" as
  an anti-pattern; this is the C++-specific instance, and `gmock`'s
  `MOCK_METHOD` macro makes over-mocking unusually easy to reach for on any
  virtual interface.
- **Coverage via `lcov`/`llvm-cov`**, same targets as the general skill's
  Domain 5 (100% critical logic, 90%+ public API, 80%+ general).

---

## False-positive traps

- A raw pointer used purely as a **non-owning observer** (R.3 — `T*`
  parameter that the function only reads/calls through, never deletes) is
  the correct, idiomatic choice, not a smart-pointer omission — verify
  ownership intent from the call site before flagging every raw pointer as
  a missing `unique_ptr`.
- `reinterpret_cast` inside a well-documented, narrow low-level boundary
  (a binary protocol parser, a hardware register mapping) with a comment
  stating the exact layout assumption being relied on is the acceptable
  case the pattern itself calls for — verify the comment actually states
  the invariant before flagging as CRITICAL rather than confirming it.
- `mutable` on a class member specifically supporting a caching/memoization
  pattern behind an otherwise-`const` public interface (lazy-computed,
  logically-const value) is a deliberate, common idiom — not automatically
  a Con.1 violation; check whether the class's public contract is still
  logically immutable before flagging.
- A `std::thread` explicitly `.detach()`-ed for a genuinely fire-and-forget
  background task, with clear documentation of what happens if the process
  exits mid-task, is the one case CP.26 doesn't blanket-forbid — verify the
  detach is deliberate and documented before flagging at the same severity
  as an accidental unhandled destructor.

## Escalate to general domain when…

- The finding is generic injection/secret-handling with no C++-specific
  nuance — that's the general skill's SEC domain.
- The finding is about test coverage percentage rather than C++-specific
  test mechanics — Domain 5 (`test-quality-lens.md`).
- A performance claim needs actual profiling or benchmark evidence to
  confirm (Per.1/Per.6 — "don't optimize without measurement") — escalate
  to `performance-audit-edho-ferdian` rather than asserting from code
  reading alone.

## Provenance

The coding-standards material in this lens is derived from the C++ Core
Guidelines at isocpp.github.io/CppCoreGuidelines.
