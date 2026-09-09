# C++ — CMake, linker & toolchain-mismatch lens

**FOLD-M.** Content is medium-depth and plausible, but
**there is no evidence of an active C++ project in Edho's workspace yet** —
unlike JavaScript/TypeScript and Django/Python (FOLD-P) which back real work
already in this ecosystem. Treat this file as a diagnostic lens ready to use
the moment a C++ project shows up, not as field-validated. Written ahead of
its original DEFER trigger ("a real C++ project appears") per the
backlog-removal decision.

Scope: CMake configuration errors, compiler errors, linker errors
(undefined references, multiple definitions), template instantiation
errors, and compiler-toolchain mismatches (GCC vs. Clang vs. MSVC, or a
mismatched C++ standard version). You fix the error only — you do not
restructure the build system's target graph or change public APIs beyond
what the error demands.

## Diagnostic commands

Run these in order to localize the error before touching anything:

```bash
# Confirm toolchain
cmake --version
c++ --version || g++ --version || clang++ --version

# Configure step — many "build" failures are actually CMake configure failures
cmake -B build -S . 2>&1 | tail -30

# The actual build — capture the exact, unedited output
cmake --build build 2>&1 | head -100

# Verbose build when the error message alone isn't enough
cmake --build build --verbose

# Static analysis catches issues that compile but are still wrong
clang-tidy src/*.cpp -- -std=c++17 2>/dev/null || echo "clang-tidy not available"
cppcheck --enable=all src/ 2>/dev/null || echo "cppcheck not available"
```

## Resolution workflow

```
1. Reproduce the error            -> capture the FULL compiler/linker/CMake
                                      diagnostic, unedited — GCC/Clang error
                                      messages often include a caret pointing
                                      at the exact token; read the whole message
2. Identify the error family      -> use the tables below
3. Read the affected file         -> understand context (includes, template
                                      instantiation site, CMakeLists.txt target
                                      graph) before editing
4. Apply the minimal fix          -> only what the error demands
5. cmake --build build            -> confirm the specific error is gone
6. ctest --test-dir build         -> confirm nothing else broke
```

**Read the compiler's caret and notes, not just the first line.** Both
GCC and Clang print a `note:` line for template errors showing the full
instantiation chain — the actual mismatched type is often several
"required from here" frames deep, not in the first error line.

## Compiler errors

| Error | Cause | Fix |
|---|---|---|
| `undeclared identifier` / `use of undeclared identifier X` | Missing `#include`, a typo, or the identifier is in a namespace that isn't `using`-ed/qualified | Add the `#include` or namespace qualification; check spelling before assuming a missing include |
| `expected ';'` (often reported one line after the real problem) | Syntax error — a missing semicolon, brace, or a macro expansion gone wrong | Check the line *before* the reported one first — C++ syntax errors routinely surface one token late |
| `no matching function for call to 'f(...)'` | Wrong argument types/count for any overload, or a needed overload doesn't exist | Read the full "candidates are:" list the compiler prints beneath the error — it shows every overload considered and why each was rejected |
| `no member named 'X' in 'Y'` | Typo, wrong class, or the member is defined behind a preprocessor guard not active in this build configuration | Confirm the member exists in the exact type used (not a similarly-named type), and check for a `#ifdef` hiding it |
| `incomplete type 'X' used in nested name specifier` / `invalid use of incomplete type` | A forward declaration is being used where the full type definition is required (e.g. calling a method, taking `sizeof`) | Add the real `#include` for the type's full definition — a forward declaration only supports pointer/reference declarations, not member access |
| `cannot convert 'X' to 'Y'` | Type mismatch at an assignment, argument, or return | Add an explicit conversion only if it's semantically valid; otherwise identify which side has the wrong type before changing either |

```bash
# Narrow down which translation unit fails first in a multi-file build
cmake --build build 2>&1 | grep -m1 "error:"
```

## Template instantiation errors

| Error | Cause | Fix |
|---|---|---|
| `template argument deduction/substitution failed` | The compiler couldn't deduce template parameters from the call, or a substitution violated a constraint (SFINAE) | Read the full instantiation chain (`required from here` notes); add an explicit template argument at the call site, or fix the constraint/concept the type fails to satisfy |
| `no type named 'X' in 'Y'` (inside a template) | A dependent type lookup failed — often a missing `typename` keyword before a dependent type name | Add `typename` before the dependent type expression (a very common C++ template gotcha, especially in generic code targeting multiple types) |
| `redefinition of default argument` | A template/function default argument specified in both declaration and definition | Keep the default argument in exactly one place (conventionally the declaration in the header) |
| `explicit instantiation of undefined template` | Attempting to explicitly instantiate a template whose definition isn't visible in this translation unit | Ensure the full template definition (not just a declaration) is `#include`-d before the explicit instantiation point |
| `constraints not satisfied` (C++20 concepts) | A template argument doesn't satisfy a `concept`/`requires` clause | Read exactly which requirement failed from the diagnostic; either the type needs the missing capability, or the constraint itself is wrong for what the template actually needs |

## Linker errors

| Error | Cause | Fix |
|---|---|---|
| `undefined reference to 'X'` (GCC/Clang) / `unresolved external symbol` (MSVC) | Declared but never defined, defined in a `.cpp` not compiled into this target, or a library isn't linked | Confirm the `.cpp` providing the definition is in the target's `add_executable`/`add_library` sources, and that any external library is in `target_link_libraries` |
| `multiple definition of 'X'` | A non-`inline` function or non-`extern` variable is defined in a header included by more than one translation unit | Mark it `inline` (or `static` for internal linkage, understanding the difference), or move the definition to a single `.cpp` file |
| `undefined reference to vtable for X` | A class with virtual functions is missing the definition of at least one of them (very often the destructor, or the first non-pure virtual function, which is where compilers commonly place the vtable) | Ensure every declared virtual function (including the destructor) has a definition; check for a pure-virtual function that was declared `= 0` by mistake |
| `duplicate symbol` (Apple/Clang linker naming for the same "multiple definition" issue) | Same root cause as `multiple definition of` above | Same fix — `inline`/`static`, or single definition |
| `relocation R_X86_64_32 against ... can not be used when making a shared object` | Mixing a static library built without `-fPIC` into a shared library target | Rebuild the static dependency with position-independent code (`-fPIC` / `CMAKE_POSITION_INDEPENDENT_CODE ON`), don't just suppress the linker error |
| Link succeeds but crashes at runtime with an ABI-looking symbol mismatch | Linking object files compiled with different C++ standard library versions, or mixing debug and release runtime libraries (MSVC's `/MD` vs `/MDd`) | Confirm every linked component was built with the same toolchain, standard library, and runtime library configuration — see Toolchain mismatches below |

```bash
nm -C build/libmylib.a | grep MissingSymbol       # confirm whether a symbol is actually present in a static lib (GCC/Clang toolchains)
ldd build/my_executable                           # check shared library resolution at runtime (Linux)
```

## CMake configuration errors

| Error | Cause | Fix |
|---|---|---|
| `CMake Error: Could not find a package configuration file for "X"` | The dependency isn't installed, or `CMAKE_PREFIX_PATH`/`<X>_DIR` doesn't point to it | Confirm the package is actually installed (via the system package manager, vcpkg, or Conan) and pass the correct prefix path, rather than vendoring a workaround |
| `CMake Error: Compatibility with CMake < X.Y has been removed` | The project's `cmake_minimum_required()` is older than what the installed CMake enforces | Bump `cmake_minimum_required(VERSION ...)` to the actual minimum the syntax in use requires — confirm the change is narrow, not a full modernization pass |
| `target_link_libraries called with target "X" which is not built by this project` | The target name doesn't exist yet at the point `target_link_libraries` is called (ordering issue), or a typo in the target name | Confirm target creation order in `CMakeLists.txt` — `add_executable`/`add_library` must appear before anything links against it, including in nested `add_subdirectory` calls |
| `Imported target "X::X" includes non-existent path` | A `find_package`-provided imported target references an include/library path that doesn't exist on this machine (often a stale CMake cache after moving/reinstalling a dependency) | Delete the `build/` directory's `CMakeCache.txt` (or the whole `build/` dir) and re-run `cmake -B build -S .` from a clean state |
| `add_subdirectory given source "X" which is not an existing directory` | Path typo, or a git submodule wasn't initialized | Check the path, and confirm submodules are checked out (`git submodule update --init --recursive`) before assuming the CMakeLists.txt is wrong |
| `FetchContent`/`ExternalProject` download fails | Network issue, a pinned URL/tag no longer exists, or a checksum mismatch | Confirm the pinned version/URL is still valid upstream; never silently drop a checksum (`URL_HASH`) verification to "make it work" |

```bash
rm -rf build && cmake -B build -S .          # clean reconfigure — confirm this isn't discarding intentional cache overrides first
cmake --build build --clean-first            # clean rebuild without wiping the CMake cache
cmake -B build -S . -DCMAKE_VERBOSE_MAKEFILE=ON
```

## Toolchain mismatches

| Symptom | Cause | Fix |
|---|---|---|
| Same source builds on one machine, fails on another with the same CMake config | Different default compiler (GCC vs. Clang) or different default C++ standard picked up by `CMAKE_CXX_COMPILER`/`CMAKE_CXX_STANDARD` | Pin the compiler and standard explicitly in `CMakeLists.txt` or a toolchain file rather than relying on each machine's default |
| MSVC-specific: `LNK2019`/`LNK2001` unresolved externals only on Windows | Mixing `/MD` (dynamic runtime) and `/MDd` (debug dynamic runtime) libraries in the same link, or a calling-convention mismatch (`__cdecl` vs `__stdcall`) between a library and its consumer | Confirm every linked library and the main target use the same `/MD`/`/MDd`/`/MT`/`/MTd` runtime library setting (`CMAKE_MSVC_RUNTIME_LIBRARY` in modern CMake) |
| Code compiles with GCC, fails with Clang (or vice versa) on the same standard | A GCC-specific or Clang-specific extension was used without realizing it, or a genuine standard-conformance bug one compiler is stricter about | Treat this as a "which compiler is actually right" question, not a "make the error go away" one — check the exact standard wording if it's not obvious, since the stricter compiler is often correct |
| Cross-compilation target errors that don't reproduce natively | Toolchain file misconfigured (wrong sysroot, wrong target triple) rather than a code problem | Verify the toolchain file's `CMAKE_SYSROOT`/`CMAKE_C_COMPILER_TARGET` match the actual target platform before assuming the source code is at fault |

## Anti-suppression reminders specific to this stack

- Never add `#pragma GCC diagnostic ignored` / `#pragma warning(disable: ...)`
  as a default fix for a compiler warning that was pointing at a real issue
  (a narrowing conversion, an unused-but-meaningful variable) — scope any
  genuine suppression to the single line with a comment explaining why, per
  the general skill's Phase 5 exception.
- Never reach for `reinterpret_cast` or a C-style cast to silence a
  type-mismatch error without first confirming the conversion is actually
  sound — see the review lens's CRITICAL section on unjustified casts.
- Never bump `cmake_minimum_required`, change the project's C++ standard
  (`CMAKE_CXX_STANDARD`), or switch package managers (vcpkg/Conan/system)
  to resolve a configuration error without flagging it to the user first —
  each is an architectural/scope decision, not a build fix, even when it
  "just works."
- Never delete and regenerate a lockfile/manifest (`vcpkg.json`,
  `conanfile.txt` pins) to silence a dependency-resolution error without
  understanding why the existing pin stopped resolving — a version genuinely
  disappearing upstream is different from a local cache/config problem, and
  treating the wrong one as "the fix" can mask a real supply-chain issue.
- Never delete `CMakeCache.txt`/`build/` on a shared or CI machine without
  confirming with the user first — it discards any deliberate cache
  overrides (`-D` flags) other maintainers may depend on.
