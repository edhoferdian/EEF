# Memory safety, binaries and kernel — MEM-SEC-01..08

**Activation.** The scope processes untrusted bytes in a memory-unsafe or
privileged context: C, C++, Objective-C, Rust `unsafe`, FFI (CGo, JNI,
N-API, Python C extensions), kernel modules and drivers, parsers and
decoders, network daemons, firmware, binary loaders, runtimes and JITs.
Load it only when recon finds such code — most web projects never need it.
Adapted from the memory-safety companion of
[cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill)
(MIT, `c1c8a8c`), in this skill's own wording.

**Already covered — extend, do not duplicate:** protocol authorization and
state machines (`protocols-messaging.md`), availability impact of a crash
(`resource-exhaustion.md` RES-SEC-07), update and plugin authenticity
(`supply-chain-release.md`), Rust/Go/C++ idioms in `language-specific.md`
where present.

**Discipline.** Re-derive every bound and lifetime from attacker-controlled
input and *all* callers, against the worst accepted case. A panic,
sanitizer report or crash proves a defect only when realistic untrusted
input reaches it; never infer memory corruption or code execution from a
label. Mode C does not run harnesses, so most native candidates that need
a sanitizer or fuzzer to settle are **Needs validation** with an exact
local check (the existing fuzz target, sanitizer build and input property
to try). Assembly, JIT output, custom allocators and foreign libraries can
escape sanitizer coverage.

## Bounds and representation

- **MEM-SEC-01 Out-of-bounds access** — a length, offset, index or
  terminator reaching a buffer without a correct bound; headroom
  recalculated after prefixes, alignment, padding and terminators; a short
  input read before its declared length is trusted.
- **MEM-SEC-02 Integer and unit errors** — attacker arithmetic before
  allocation, copy, loop, index or pointer math: `a - b` with `b > a`,
  `count * size` overflow, negative to unsigned, 64-bit lengths narrowed to
  32 bits, `-1` sentinels becoming huge sizes; bytes vs elements vs code
  units vs pages mixed between parse, check, allocation and copy (a check
  in the same wrong unit as the allocation is still wrong).
- **MEM-SEC-03 Uninitialized data crossing a boundary** — buffers, padding,
  struct fields or vector capacity returned, hashed, serialized or sent
  before initialization, with an observable consumer.

## Lifetime, type and concurrency

- **MEM-SEC-04 Use-after-free and double free** — owners released while
  callbacks, timers, iterators, borrowed slices or cached raw pointers can
  still use them; every error, cancel, close and realloc path; observers
  not drained on free.
- **MEM-SEC-05 Type confusion and ownership races** — tags, vtables, union
  discriminators or foreign handles checked differently from what is later
  read; stale tags after reuse; non-atomic retain/release or check-then-use
  across threads; shared parser state, lazy init and signal handlers that
  invalidate a bound established earlier. A hypothetical interleaving with
  no security-relevant state change stays Needs validation.

## FFI and ABI

- **MEM-SEC-06 Contract mismatch across the boundary** — caller and callee
  disagreeing on who allocates, frees or pins a buffer, how long a pointer
  stays valid, or whether a length is bytes or elements; null and
  zero-length handling; callbacks retained past teardown; struct layout,
  packing, alignment, enum width, endianness or calling convention that
  differs by architecture or build flag; panics or exceptions unwinding
  across an ABI that forbids it.

## Loading and privileged interfaces

- **MEM-SEC-07 Loader trust** — a privileged process loading a library,
  plugin or helper from a path a less-trusted user can write, or resolving
  a bare name through the working directory or environment (DLL search
  order, `LD_LIBRARY_PATH`, `PATH`); a signature checked on one file while
  another is mapped; offsets, counts, sections or relocations trusted
  before range and overlap checks; JIT, optimizer and interpreter
  disagreeing on types or bounds; function pointers surviving unload. A
  user loading their own plugin into their own process is not a boundary.
- **MEM-SEC-08 Kernel and powerful interfaces** — a syscall, ioctl or
  driver that reads user memory twice (validate once, use again); unchecked
  dispatch-table indices; unbalanced object lifetimes on externally
  reachable objects; a device node, admin socket or management API that
  validates shape but not the caller's authority. Interface permissions
  defined outside the repo make it Needs validation.

## How to hunt it

Build one table per parser or FFI boundary: accepted length and type,
checked representation, allocation owner, consumer, thread, teardown — most
native findings are a single disagreement in that table. Audit fixes and
duplicated paths: a check in one caller, architecture, feature flag or
compatibility path does not protect its siblings.
