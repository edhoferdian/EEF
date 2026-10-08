# Lens status, per-stack history, and provenance

Moved out of `SKILL.md` so the lens layer loads lean. Nothing here is needed
to run a review — the detection table and rules stay in `SKILL.md`. Open this
file when deciding how much to trust a lens (FOLD-M vs field-proven), when
adding a new stack, or when auditing where a lens's content came from.

## Lens status

**Status after the kelompok-1 follow-up analysis: Angular and NestJS are
active, proven lenses** (verified against Edho's real `ghostfolio` project,
an Nx monorepo running both), not speculative additions. **Go, Rust, Vue,
and the twelve stacks added below are all FOLD-M**: content is medium-depth
and plausible, but **there is no evidence of an active project in any of
these stacks in Edho's
workspace yet** — unlike Angular/NestJS (verified against `ghostfolio`) or
Python/React (already exercised elsewhere in this ecosystem). Treat these as
ready-to-use lenses the moment a matching project shows up, not as
field-validated ones. More stacks follow the same file shape and slot into
the detection table in `SKILL.md` as they're written — adding one doesn't
require touching `SKILL.md` beyond that table.

## Stacks built (FOLD-M, ahead of trigger)

The original 34-item DEFER backlog (from the kelompok-1 follow-up analysis)
was gated on "a real project in that stack appears in Edho's own work." That
gate assumed a single-user, personally-curated ecosystem; now that this
ecosystem is distributed to many users, waiting for Edho's own projects to
justify writing industry-standard, well-documented framework content no
longer makes sense — every stack below was built now instead, following the
same content/quality bar as the already-active lenses (Angular, NestJS,
Python, React). Build-error handling for the same stacks lives
in `build-fix-edho-ferdian`'s own reference files (see that skill's own
Provenance/reference table), which are not identical in depth to these
review lenses since the two skills need different depth per stack.

- **PHP/Laravel** — `references/laravel.md` (idioms, Eloquent N+1/scopes,
  Form Request validation, migration reversibility, test-shape checks).
  Security criteria stay solely in
  `security-review-edho-ferdian/references/language-specific.md`
  §"PHP / Laravel", cross-referenced rather than duplicated.
- **Java/Spring + Quarkus** — `references/java-spring.md` (idioms,
  architecture, JPA/Panache correctness, testing conventions for both
  frameworks, Quarkus as an internal `## Quarkus` sub-section given the ~85%
  overlap). Security stays in
  `security-review-edho-ferdian/references/language-specific.md`
  §"Java / Spring Boot". `jpa-patterns` landed as
  `data-layer-patterns-edho-ferdian/references/jpa.md` per the original plan.
- **Kotlin** — `references/kotlin.md` (idiomatic patterns/null-safety,
  coroutine & Flow structured-concurrency bugs, Exposed ORM query
  correctness, Ktor server conventions, finding code CQ-14). The Exposed-ORM
  section is kept inline here for now with a pointer noting it could later relocate
  to `data-layer-patterns-edho-ferdian` the way JPA did — not yet moved.
  Kotlin has no security cross-reference yet (unlike Java/PHP); flag that gap
  explicitly rather than inventing findings.
- **Swift/Apple** — `references/swift.md` (SwiftUI `@Observable` state/view
  composition, Swift 6.2 Approachable Concurrency, actor-based persistence,
  protocol-oriented DI/testability). Ground-truth
  verification of any Swift finding is structurally impossible on Edho's own
  Windows 10 machine (no Swift toolchain runs there) — a future session using
  this lens must say so explicitly rather than implying it ran `swift build`.
- **Mobile cross-platform** — `references/react-native.md` (built first and
  most thoroughly, per the cheapest-transfer-from-React reasoning),
  `references/flutter.md`, `references/android.md` (Clean Architecture
  layering), and `references/compose-multiplatform.md`. None of these four
  stacks has a security cross-reference in
  `security-review-edho-ferdian` yet — findings route to the general
  SEC-01/02/10 codes rather than inventing stack-specific ones.
- **.NET** — `references/dotnet.md` (async/DI/nullable/EF Core idioms shared
  by C# and F#, with an `## F#` subsection for functional-idiom findings).
- **C++** — `references/cpp.md` (RAII/ownership, Rule of Five,
  concurrency-primitive misuse, memory-safety anti-patterns).
- **PyTorch** — `references/pytorch.md` — deliberately narrow: framework
  mechanics only (undocumented tensor shape assumptions, hardcoded device
  placement, inconsistent AMP autocast/GradScaler sequencing, mismatched
  DataLoader worker config), filed under CQ-10. Generic ML review and the
  operational-lifecycle axis stay in
  `code-review-edho-ferdian/references/mle-lens.md` — this file
  cross-references it rather than re-covering it, per that file's own
  "Handoffs" section.
- **Perl** — `references/perl.md` (idiom/OO/testing lens, CQ-15; Moo vs
  blessed hashrefs, modern signatures, postfix deref, Test2::V0 vs
  Test::More). The earlier "skipped permanently" call was reversed
  2026-09-09 — it assumed no full Perl content existed upstream, which was
  wrong; content for patterns, security, and testing all existed and simply
  hadn't been brought in yet. Security criteria stay solely in
  `security-review-edho-ferdian/references/language-specific.md` §"Perl"
  (now a full section, not the old SEC-16..19-only placeholder), cross-
  referenced rather than duplicated. Detect: any `.pl`/`.pm`/`.t` file, or a
  `cpanfile`/`Makefile.PL`/`.perlcriticrc` at repo root.
- **ArkTS/HarmonyOS** — `references/arkts.md` (review/idiom lens, CQ-16):
  V2 state-management compliance (`@ComponentV2`/`@Local`/
  `@Param`/`@Monitor`, never the V1 decorators), Navigation-only routing,
  ArkTS syntax-constraint violations, MVVM layering — covers both review and
  implementation concerns in one lens rather than splitting them.
  Security lives in
  `security-review-edho-ferdian/references/language-specific.md` §"ArkTS /
  HarmonyOS" (SEC-08 cross-reference). Detect: `oh-package.json5` or
  `module.json5` at repo root, or `.ets` files in scope.
- **Ruby / Rails** — `references/ruby.md`. Detect: `Gemfile` at repo root,
  `config/routes.rb` present, or `.rb`/`.rake`/`.erb` files in scope.
  This lens is built from convention/checklist material rather than a
  dedicated, enumerated Ruby reviewer, so it is thinner
  than the Go/Laravel/Java ones; say so if a finding feels underspecified
  rather than inventing depth the source doesn't have. Security lives in
  `security-review-edho-ferdian/references/language-specific.md` §"Ruby /
  Rails".

## Provenance

This `SKILL.md` (the lens-layer orchestration itself — detection table,
relationship contract, confidence/reflection rules) is original scaffolding
written for this ecosystem, not a direct port of a single external skill or
agent. `references/go.md`, `references/rust.md`, and `references/vue.md`
are all FOLD-M — see "Lens status" above for what that means
here.
