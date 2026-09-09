# Language Lens — Perl

Supersedes the earlier "skipped permanently, not deferred" decision recorded
in `SKILL.md` — that decision assumed no dedicated Perl content was
available; dedicated Perl patterns, security, and testing content was
actually present upstream and simply never incorporated.

**Detect.** Any `.pl`/`.pm`/`.t` file in review scope, or a `cpanfile`/
`Makefile.PL`/`.perlcriticrc` at repo root.

**Boundary — read before flagging anything.** Generic injection (SQL/
command/path traversal via string concatenation), generic secret handling,
generic function-length/nesting/magic-number checks, and generic N+1
detection are **already owned by `references/review-checklist.md`** in the
general skill. Security-relevant Perl findings (taint mode, unsafe `open`/
`system`/`eval`, SQL interpolation, ReDoS, path traversal, XSS/CSRF) live
solely in `security-review-edho-ferdian/references/language-specific.md`
§"Perl" — this file cross-references that section rather than duplicating
it. This lens adds only what is specific to **modern Perl idiom compliance,
Moo-based OO design, and testing conventions**.

**Code placement.** Findings land as **CQ-15 (Perl idiom & modern-syntax
anti-patterns)** in the general report — the next unused CQ code following
Kotlin's CQ-14. Perl-specific security items belong to
`security-review-edho-ferdian/references/language-specific.md` §"Perl";
this file does not duplicate them.

---

## Ground-truth commands

```bash
perl -c lib/MyApp/Foo.pm          # syntax check only, no execution
perlcritic --severity 3 lib/      # static lint against .perlcriticrc
perltidy --profile=.perltidyrc -b lib/MyApp/Foo.pm  # formatting check
prove -lr t/                      # run the test suite
cover -test && cover -report text # coverage, if Devel::Cover is set up
```

Do not label a taint-mode or ReDoS finding as [High confidence] without
having actually run `perl -T` or a timing check — reading the pattern and
recognizing the shape is reasoning, not verification, per the general
skill's Phase 2 rule. Cap at [Medium confidence] and name the confirming
command.

---

## Lens criteria

### HIGH

- **Legacy `use strict; use warnings;` boilerplate instead of a single `use
  v5.36`** (or the module/project's declared minimum modern version) — `use
  v5.36` enables `strict`, `warnings`, `say`, and subroutine signatures in
  one pragma. Flag only when the codebase's declared minimum Perl version
  (check `cpanfile`/`Makefile.PL` `requires 'perl', '5.XX'`) actually
  supports it — don't demand `v5.36` in a codebase pinned to an older
  runtime for a real compatibility reason.
- **Manual `my ($x, $y) = @_;` argument unpacking with hand-rolled default
  handling (`$port //= 5432;`)** where the module's minimum Perl version
  already supports subroutine signatures (5.20+, mainstream from 5.36) —
  `sub connect_db($host, $port = 5432, $timeout = 30) { ... }` replaces both
  the unpacking and the default-assignment boilerplate, and gives automatic
  arity checking the manual form doesn't.
- **Blessed hashref OO with hand-written accessors** (`sub name { return
  $_[0]->{name} }`, `bless \%args, $class`) instead of `Moo` — the hand-rolled
  form has no attribute validation, no `required`, no type constraints, and
  reimplements what `Moo` already provides declaratively:
  ```perl
  has name  => (is => 'ro', isa => Str, required => 1);
  has roles => (is => 'ro', isa => ArrayRef[Str], default => sub { [] });
  ```
  Reserve `Moose` only for code that genuinely needs its metaprotocol
  (introspection, `around`/`before`/`after` method modifiers at scale) —
  don't flag plain `Moo` usage as under-powered.
- **Indirect object syntax** — `my $obj = new Foo(bar => 1);` instead of
  `Foo->new(bar => 1);`. Indirect syntax is genuinely ambiguous to Perl's
  parser (it can misparse as a function call) and is a long-standing,
  unambiguous anti-pattern with no legitimate use.
- **Circumfix dereferencing in a nested-structure chain** (`@{
  $data->{users}[0]{roles} }`) instead of postfix dereference (`$data->
  {users}[0]{roles}->@*`) — postfix deref reads left-to-right in the same
  order the structure is actually navigated; circumfix forces the reader to
  jump to the end of the expression first. Flag only genuinely nested/
  chained cases — a single top-level `@{ $ref }` is not itself a finding.
- **Positional regex captures (`$1`, `$2`, `$3`) in a pattern with three or
  more captures**, or where the capture's semantic meaning isn't obvious
  from position alone — named captures (`(?<timestamp> ... )`, read back via
  `$+{timestamp}`) survive a later edit that reorders or adds a capture
  group; positional captures silently break.
- **`eval { }; if ($@) { ... }` for ordinary exception handling** in a
  codebase whose minimum Perl version is 5.34+ (or already depends on
  `Try::Tiny`) — prefer native `try`/`catch` (5.34+, stable 5.40) or
  `Try::Tiny` for the clearer block structure and to avoid `$@`'s
  well-known reentrancy footguns (a `DESTROY` handler or nested `eval`
  during the `catch` can clobber `$@` before it's read).

### MEDIUM

- **`no strict 'refs'` used to build a symbolic reference from a variable**
  (`${"My::Package::$var"} = $value;`) instead of a hash — almost always
  better expressed as `my %registry; $registry{$var} = $value;`. (If `$var`
  is ever attacker-influenced this is also a security finding — see
  `security-review-edho-ferdian`'s Perl §CRITICAL entry on `eval`/dynamic
  refs; this MEDIUM entry covers the pure-maintainability case where input
  is trusted/internal.)
- **A mutable package-global used as configuration** (`our $TIMEOUT = 30;`)
  instead of `use constant TIMEOUT => 30;` or a `Moo` attribute with a
  default — package globals are trivially reassignable from anywhere that
  can see the package, which defeats the purpose of a "configuration
  constant."
- **Excessive `$_`-chaining across multiple `map`/`grep` in one expression**
  (`map { process($_) } grep { validate($_) } @items`) — readable once, hard
  to debug once a third stage is added. Prefer naming the intermediate:
  `my @valid = grep { validate($_) } @items; my @results = map {
  process($_) } @valid;`
- **Two-argument `open` used purely for a hardcoded, non-user-influenced
  path** (e.g. a fixed config file read at startup) — still worth flagging
  as a MEDIUM idiom/consistency issue (three-arg `open` with an explicit
  encoding layer is the modern default and self-documents the read/write
  mode) even when there's no injection risk, since the general skill's
  security domain won't catch it when the path is trusted.
- **A module missing `namespace::autoclean`** after `use Moo`/`use Moose` —
  without it, `Moo`/`Moose`-imported keywords (`has`, `with`, `extends`)
  remain visible as callable subs on instances of the class, which is
  usually not intended.
- **`Exporter` used without `@EXPORT_OK`/an explicit `import` tag** — bare
  `@EXPORT` (unconditional export) pollutes every importing namespace by
  default; prefer `use Exporter 'import'; our @EXPORT_OK = qw(...);` so
  callers opt in to what they need.

---

## Testing lens (from `perl-testing`)

- **`Test::More` used in new test code** when the project has no compatibility
  constraint pinning it there — prefer **Test2::V0** for new tests: richer
  deep-comparison builders (`hash { field name => 'Alice'; etc() }`, `bag {
  ... }` for order-independent comparison), better diagnostic output on
  failure, and full backward compatibility with `Test::More`-style
  assertions in the same suite. Don't flag existing `Test::More` suites for
  a wholesale migration — flag only new test files added to a project that
  has already adopted Test2::V0 elsewhere.
- **Missing `done_testing;` at the end of a test file** — without it (or a
  fixed `plan tests => N`), a test file that dies partway through or is
  silently truncated by a bug in test setup can appear to "pass" by simply
  running no assertions. This is the Perl-test equivalent of a test file
  with zero `expect()` calls in other stacks — flag it every time.
- **`prove` invoked without `-l`** in CI config or documented dev commands
  — `prove t/` without `-l` (or an equivalent `PERL5LIB`/`lib::relative`
  setup) fails to find modules under `lib/`, which either breaks the run
  entirely or, worse, silently picks up a stale installed version of the
  same module from `@INC`.
- **Monkey-patching a package's sub directly** (`*MyApp::API::fetch_user =
  sub { ... };`) for a test double instead of `Test::MockModule` — direct
  glob assignment has no automatic restoration, so a mock defined in one
  test file can leak into a later one that runs in the same process
  (`prove -j` parallel runs make this worse, not better, since state can
  leak across processes sharing a fixture). `Test::MockModule->new(...)`
  restores the original on scope exit.
- **Shared mutable state declared with `our` inside a test file** instead
  of `my` scoped to the subtest — `our` variables are visible across
  subtests in the same file and can leak state between them; `my` inside
  each `subtest { ... }` block keeps state properly isolated.
- **A test suite claiming to cover business logic with no `Devel::Cover`
  run behind the coverage claim** — same discipline as the general skill's
  Domain 5: an 80%+ coverage claim needs `cover -test && cover -report
  text` output, not just "the tests look thorough."

---

## False-positive traps

- Indirect object syntax inside a `BUILD`/`BUILDARGS` override or other Moo/
  Moose internals-adjacent code that the framework itself generates is not
  a finding — the anti-pattern is user-written `new Foo(...)` call sites,
  not framework-internal constructs that happen to resemble the shape.
- `eval { }; if ($@)` retained in a module that must stay compatible with a
  Perl version older than 5.34 (check `requires 'perl', '5.XX'` in
  `cpanfile`/`Makefile.PL` before flagging) is the correct choice, not an
  anti-pattern — native `try`/`catch` isn't available to it.
- A package-global (`our $X`) that is genuinely intended as a test-only
  override point (documented, and only ever localized with `local` inside
  tests, never assigned globally in application code) is a recognized Perl
  testing idiom, not the "mutable global as configuration" MEDIUM finding
  above — check whether production code ever assigns to it before flagging.
- `Test::More` retained in an existing, large, already-passing test suite is
  not itself a finding — the migration-to-Test2 guidance above applies to
  new test files, not a demand to rewrite working suites.

## Escalate to general domain when…

- The finding is generic SQL/command/path injection, taint-mode gaps,
  ReDoS, CSRF, or XSS — that's `security-review-edho-ferdian`'s Perl
  section (§"Perl" in `references/language-specific.md`); flag it there,
  note the Perl-specific API/idiom only if it adds context the security
  section doesn't already cover.
- The finding is about test coverage percentage or test *quality* beyond
  Perl-specific mechanics (assertion style, missing edge cases) — that's
  Domain 5 (`test-quality-lens.md`) in the general skill.
- A performance claim needs profiling to confirm (e.g. "this regex is
  slow," "this loop allocates too much") — escalate to
  `performance-audit-edho-ferdian` and ask for `Devel::NYTProf` output
  before asserting it as fact.

## Provenance

Supersedes the earlier "skipped permanently" decision — dedicated Perl
content was assumed absent but was actually present and unincorporated.
