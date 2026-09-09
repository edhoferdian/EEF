# Perl — dependency, syntax & test-bootstrap resolution lens

Supersedes the earlier "skipped permanently, not deferred"
decision recorded in `SKILL.md` — that decision assumed no dedicated Perl
build/testing content was available; fuller Perl patterns, security, and
testing content was actually available and simply never incorporated.

Scope: `cpanm`/`cpan` dependency-resolution failures, `perl -c` syntax-check
errors, and `prove`/`Test::More`/`Test2::V0` bootstrap failures. You fix the
error only — you do not refactor module structure or change subroutine
signatures beyond what the error demands.

**Detect.** Any `.pl`/`.pm`/`.t` file in the failing build, or a `cpanfile`/
`Makefile.PL`/`Build.PL` at repo root.

## Diagnostic commands

Run these in order to localize the error before touching anything:

```bash
# Confirm toolchain and installed module state
perl -v
perl -Ilib -MMyApp -e 'print "loads OK\n"'   # sanity-check the module actually compiles/loads

# Syntax check only — no execution, catches compile-time errors fast
perl -c lib/MyApp/Foo.pm
perl -Ilib -c bin/myapp

# Dependency resolution
cpanm --installdeps .          # install everything cpanfile/Makefile.PL declares
cpanm --local-lib=local Module::Name   # isolate install to avoid polluting system Perl
carton install                 # if the project pins deps via cpanfile + carton
carton exec -- perl -c lib/MyApp/Foo.pm

# Test bootstrap
prove -l t/                    # -l puts lib/ in @INC — omitting it is the #1 prove failure
prove -lv t/unit/failing.t     # verbose single-file run to isolate a specific failure
```

## Resolution workflow

```
1. Reproduce the error           -> capture the exact message, unedited
2. Identify the error family     -> use the tables below (syntax / cpanm / prove)
3. Read the affected file        -> understand context before editing
4. Apply the minimal fix         -> only what the error demands
5. perl -c <file>                -> confirm the file compiles clean
6. prove -lr t/                  -> confirm nothing else broke
```

## `perl -c` syntax errors

| Error | Cause | Fix |
|---|---|---|
| `syntax error at ... near "..."` | Malformed statement — missing semicolon, unbalanced brace/paren, or a reserved word used as a bareword | Read the exact line and the one before it — Perl's parser often reports the error one token *after* the actual mistake (a missing `;` on the previous line is the most common cause) |
| `Global symbol "$x" requires explicit package name` | `use strict` is active and `$x` was never declared with `my`/`our`/`local`, or a typo in a previously-declared variable name | Declare with `my $x` at first use, or fix the typo — never respond by removing `use strict` |
| `Can't locate object method "foo" via package "Bar"` | Method doesn't exist on that package/class, or `Bar` was never `use`d/`require`d before the call | Confirm the method is actually defined (check for a typo, and check `@ISA`/`with`/parent classes for inherited methods); confirm the module providing it loaded without silently failing |
| `Can't locate Module/Name.pm in @INC` | Module isn't installed, or isn't in the search path (`@INC`) | Check `cpanm --installdeps .` was run in the right lib environment; if it's an in-repo module, confirm `use lib 'lib'` or `prove -l` is putting `lib/` on `@INC` |
| `Bareword "FOO" not allowed while "strict subs" in use` | An unquoted string that looks like a bareword sub call, but no such sub exists (often a missing `use constant` or a stray identifier) | Quote it if it was meant as a string, or define/import the constant/sub if it was meant as one |
| `Odd number of elements in hash assignment` | A `(key, value, ...)` list assigned to a hash has an odd count — usually a missing value, a stray/missing comma, or a list function returning fewer items than expected | Recount the list literally; check that any function call inside the list actually returns a value (not `undef` from an early return) |
| `Insecure dependency in ... while running with -T switch` | Taint mode (`-T`) blocked a dangerous operation (`open`, `system`, `eval`) because it received unvalidated external data | This is a taint-mode *security* finding, not a bug to route around — validate/untaint via a narrow, anchored regex capture before the dangerous call; see `security-review-edho-ferdian/references/language-specific.md` §"Perl" rather than disabling `-T` |

```bash
# Narrow down which file fails first across a whole lib/ tree
find lib -name '*.pm' -exec perl -Ilib -c {} \; 2>&1 | grep -v "syntax OK"

# Confirm a single file in isolation with the project's lib/ on @INC
perl -Ilib -c lib/MyApp/Foo.pm
```

## `cpanm`/`cpan` dependency-resolution failures

| Error | Cause | Fix |
|---|---|---|
| `! Installing X failed. See ... for details.` | The module's own build/test step failed (often a missing system library, not a Perl problem) | Read the linked build log — most failures here are a missing C library (`libssl-dev`, `libxml2-dev`, etc.) the XS module needs to compile against, not a Perl-level issue |
| `Can't find X on CPAN` / `! Finding X on mirror ... failed` | Module name typo, module was removed/renamed upstream, or a network/mirror issue | Confirm the exact distribution name on MetaCPAN; retry with `--mirror` pointed at a known-good mirror if it's a transient network failure |
| `Warning: prerequisite X 1.23 not found` (build proceeds anyway) | `cpanm` installed the module but a stated prerequisite version wasn't satisfiable | Don't ignore this even though the build "succeeded" — the module may misbehave at runtime; pin/upgrade the prerequisite explicitly in `cpanfile` |
| `Module::Name only supports Perl X.Y.Z` (version mismatch) | The installed `perl` binary is older/newer than the module requires | Confirm which `perl` `cpanm` is actually installing against (`cpanm` uses whatever `perl` resolves to first in `$PATH`) — use a version manager (`perlbrew`/`plenv`) if the project needs a different major version than system Perl |
| `Configure failed for X - ... Makefile.PL ... exit -1` | The distribution's own `Makefile.PL` failed before any compilation started — often a missing build-time-only dependency (`ExtUtils::MakeMaker` version too old, etc.) | Read the actual `Makefile.PL` output above the failure line; `cpanm --local-lib=local ExtUtils::MakeMaker` to update the build tool itself is a common fix |
| `Circular dependency detected` | Two or more `cpanfile`/prerequisite declarations depend on each other | Re-examine the `cpanfile` — this usually means a dependency was declared that shouldn't be (a module requiring itself transitively through an unrelated package) |
| `local::lib` not activated / installs go to system Perl unexpectedly | `cpanm --local-lib=local` was used but the environment (`PERL5LIB`, `PATH`) wasn't set up to prefer it afterward | `eval $(perl -Ilocal/lib/perl5 -Mlocal::lib)` (or the project's documented activation step) before running anything that should see the local install |

```bash
cpanm --installdeps .                    # install from cpanfile/Makefile.PL
cpanm --local-lib=local --installdeps .  # isolated install, doesn't touch system Perl
cpanm -n Module::Name                    # skip that module's own test suite (last resort — confirm with the user first if it masks a real problem)
carton install                           # if the project uses Carton for pinned, reproducible deps
carton show                              # what carton actually resolved/installed
cpan -j <path-to-cpan-config>            # fallback to core `cpan` client if cpanm itself is unavailable
```

## `prove`/`Test::More`/`Test2::V0` bootstrap failures

| Error | Cause | Fix |
|---|---|---|
| `Can't locate MyApp/Foo.pm in @INC` (inside a test run, module exists in `lib/`) | `prove` was run without `-l`, so `lib/` was never added to `@INC` | `prove -l t/` (or `-Ilib` explicitly) — this is the single most common `prove` bootstrap failure |
| Test file exits with no output / hangs | Missing `done_testing;` combined with a fatal error earlier in the file that wasn't caught, or a `t/` file with no plan and no assertions at all | Add `done_testing;` at the end of every test file; if it hangs, check for an unclosed `subtest`/uncaught exception mid-file rather than a genuine infinite loop first |
| `Tests were run but no plan was declared` | Neither `plan tests => N;` nor `done_testing;` was called | Add `done_testing;` (preferred over a fixed count, which breaks the moment a test is added/removed) |
| `# Looks like your test exited with ... before it could output TAP` | The test file died (uncaught exception, `BEGIN` block failure, or a `use` of a module that itself failed to load) before printing any TAP output | Run the single file directly with `perl -Ilib t/unit/failing.t` (bypassing `prove`'s TAP parsing) to see the real Perl error/stack trace `prove` was swallowing |
| `Can't locate object method "field" via package "Test2::...` (or similar Test2 builder errors) | `Test2::V0` deep-comparison builder syntax (`hash { field ... }`) used without `use Test2::V0;` actually imported, or an old cached `Test::More`-only import | Confirm `use Test2::V0;` is present and that no earlier `use Test::More;` in the same file is shadowing the builder DSL |
| `Test::MockModule` mock not taking effect / original method still runs | The mock was constructed but the mocked call happens through a different code path (e.g. the class was already `use`d and cached before the mock, or the mock target is a re-exported function rather than the defining package's method) | Mock the package that actually defines the method, not a re-exporting wrapper; confirm the mock object stays in scope for the duration of the call under test |
| `Insecure dependency` inside a test run under `-T` | Same taint-mode cause as the syntax-error table above, surfaced through the test harness instead of a direct run | Same fix — validate/untaint via an anchored capture; do not disable `-T` to make the test pass |

```bash
prove -l t/                       # baseline — always include lib/ in @INC
prove -lv t/unit/failing.t        # verbose, single file, to see full diagnostic output
perl -Ilib t/unit/failing.t       # bypass prove/TAP entirely to see the raw Perl error
prove -lr --state=failed t/       # re-run only what failed last time, after a fix
```

## Anti-suppression reminders specific to this stack

- Never remove `use strict`/`use warnings` (or the `v5.36`+ pragma that
  enables them) to make a syntax error stop appearing — that hides the
  underlying bug instead of fixing it, and reintroduces the exact class of
  silent-failure bugs those pragmas exist to prevent.
- Never disable taint mode (`-T`) or strip an `-T` shebang to get a script
  running — an `Insecure dependency` failure is taint mode doing its job;
  fix the input-validation gap it's pointing at (see
  `security-review-edho-ferdian/references/language-specific.md` §"Perl"),
  don't remove the flag.
- Never add `cpanm -n` (skip-tests) as a permanent fix for a dependency that
  fails its own test suite — that's masking a real upstream problem; use it
  only as a documented, temporary escape hatch, and flag it to the user
  rather than silently baking it into CI.
- Never hand-edit a generated `cpanfile.snapshot` (Carton's lockfile) — the
  only correct way to change pinned versions is `carton install` after
  editing `cpanfile` itself, so the snapshot stays consistent with what was
  actually resolved.
- Never add a blanket `## no critic` comment to silence a `perlcritic`
  finding — scope it to the specific policy (`## no critic
  (InputOutput::ProhibitTwoArgOpen)`) with a reason, or fix the underlying
  issue.

## Provenance

Supersedes the earlier "skipped permanently" decision — Perl
content was assumed absent but was actually available and simply never
incorporated.
