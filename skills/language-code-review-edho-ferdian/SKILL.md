---
name: language-code-review-edho-ferdian
description: >-
  Language- and framework-specific code review lenses layered on top of the
  general four-domain review in code-review-edho-ferdian — idioms, framework
  security misconfigurations, ORM/query correctness, performance traps, and
  testing conventions for React, Python, FastAPI, and Django (more stacks to
  follow). Use whenever a review touches a specific language/framework and the
  generic checklist isn't enough — "review kode Go/Python/React ini", "audit
  Django models", "cek FastAPI endpoint ini", or when the user names a stack
  while asking for review. Loads only the lens file(s) matching the detected
  stack. Inherits Reflection and Critique-Correction gates from
  code-review-edho-ferdian.
---

# Language Code Review — Edho Ferdian Mode (Lens Layer)

You are still the **same senior engineer** from `code-review-edho-ferdian` —
this skill does not replace that review, it sharpens it. A generic checklist
catches generic bugs. It does not know that a Django serializer with
`fields = '__all__'` leaks columns, that a FastAPI route awaiting nothing
inside `async def` blocks the event loop, or that `key={index}` silently
corrupts React list state. That is what this skill adds: **per-stack idiom,
framework-misconfiguration, and ORM/query knowledge**, expressed as extra
criteria slotted into the domains the general skill already reports under.

## Relationship contract (read this first)

**This is a lens layer, never a standalone review.** It does not have its own
Phase 0–5 pipeline, its own report format, or its own Reflection/Critique
gate — it borrows all of that from `code-review-edho-ferdian`.

- If `code-review-edho-ferdian`'s Phases aren't already running, **run them
  first**. This skill's job is Phase 0's "conditional-lens detection" step
  and Phase 1's domain checklists — nothing else.
- Every lens finding lands inside **Domain 1 (CQ)**, **Domain 2 (SEC)**, or
  **Domain 3 (PERF)** of the general report, using that domain's existing
  severity table, confidence labels, and finding template. A lens never opens
  a new top-level domain (contrast with `accessibility-lens.md`'s `A11Y-##`,
  which the general skill already treats as a deliberate exception because
  accessibility doesn't fit CQ/SEC/PERF cleanly — language lenses do fit, so
  they stay inside those three).
- **Security items (SEC-08) no longer live in these reference files.** Each
  `references/*.md` file below used to hold its own stack-specific security
  criteria inline; those have all moved to `security-review-edho-ferdian/
  references/language-specific.md` as the single source of truth (removes
  the drift risk of the same criterion existing in two places). Each
  reference file still says, at its "Code placement" line, exactly which
  security items moved and where — load that file (or delegate to
  `security-review-edho-ferdian` directly) when Domain 2 needs stack-specific
  security depth.
- **Never duplicate what the general checklist already owns.** Generic
  injection (SQL/command/path), generic secret handling, generic function
  length/nesting/magic-number checks, and generic N+1 detection are owned by
  `references/review-checklist.md` in the general skill. A language lens adds
  only what is **specific to that language/framework** — e.g. Django's
  `select_related`/`prefetch_related` mechanics for N+1, not N+1 itself.
  Every lens file below states this boundary again at its own top.
- Both Phases 3 (Reflection) and 4 (Critique-Correction Loop) in the general
  skill already run over the *whole* finding set, lens findings included —
  this skill does not add a second reflection pass.

## Phase 0 extension — stack detection

Run this as part of the general skill's Phase 0 "conditional-lens detection"
step, immediately after the database/accessibility/RAG lens checks. Detect by
**manifest file first, extension second** — a `.py` file alone doesn't tell
you whether it's plain Python, Django, or FastAPI, but `manage.py` does.

| Signal found | Load |
|---|---|
| `package.json` present and its dependencies (`dependencies` or `devDependencies`) include `react` or `react-dom` | `references/react.md` |
| `manage.py` at repo root, or a `settings.py` with `INSTALLED_APPS`/`django.` imports | `references/python.md` + `references/python-django.md` |
| A FastAPI import (`from fastapi import FastAPI` / `import fastapi`) in `main.py`, `app/main.py`, or the file(s) in review scope | `references/python.md` + `references/python-fastapi.md` |
| `celery` in `requirements*.txt`/`pyproject.toml`, or a `celery.py`/`tasks.py` pattern in scope (add-on to the Django/Python detection above — loads alongside `python.md` + `python-django.md` when Django is also detected) | `references/python-django-celery.md` |
| `@nestjs/core`/`@nestjs/common` in `package.json`, a `nest-cli.json` at the project root, or `@Module`/`@Controller`/`@Injectable` decorators in scope (detect per-project in an Nx/monorepo layout — e.g. `ghostfolio`'s Nest API alongside its Angular app) | `references/nestjs.md` |
| `package.json` present and its dependencies include `@angular/core` | `references/angular.md` (plus `references/nestjs.md` too when `@nestjs/core` is also present in the same repo — e.g. an Nx monorepo with an Angular app and a Nest API, `ghostfolio`'s actual shape) |
| `go.mod` at repo root, or any `.go` file in scope | `references/go.md` |
| `Cargo.toml` at repo root, or any `.rs` file in scope | `references/rust.md` |
| `package.json` present and its dependencies include `vue` | `references/vue.md` (its own §9 sub-section covers Nuxt when `nuxt` is also present — no separate file to load) |
| Any `.py` file in scope and none of the above matched | `references/python.md` alone |

Multiple signals can be true at once — load every reference that matches
(e.g. a Django project with a React frontend in the same repo loads
`react.md` + `python.md` + `python-django.md`; a Django project that also
uses Celery loads `python.md` + `python-django.md` + `python-django-
celery.md`). State which lens file(s) you loaded in the Phase 0 summary,
same as the other conditional lenses. If no signal matches (a stack without
a reference file yet — e.g. Java/Kotlin/Swift/PHP), skip silently — the
general four-domain review still applies in full; there is just no extra
lens on top yet.

`python-fastapi.md` and `python-django.md` each declare "Requires:
`python.md` (load first)" at their own top — they assume general Python
idiom checks already ran and only add framework-specific criteria on top.

## Ground-truth-first rule

Every reference file below has a **Ground-truth commands** section with
real, runnable commands for that stack. Run them — via the general skill's
Phase 2 verification step — before asserting a lens finding as fact. This
mirrors the general skill's own rule (`database-lens.md` already sets this
precedent for `EXPLAIN ANALYZE`): reading code and guessing what a linter or
type-checker "would" say is reasoning, not verification.

**Unverified findings are capped at [Medium confidence].** A lens finding
that could be confirmed by a ground-truth command but wasn't (tool not
installed, not reachable, or you chose not to run it) never gets [High
confidence] — say what command would confirm it, exactly as the general
skill's Phase 2 confidence rule already requires.

## Confidence floor & noise control

- **>80% confidence threshold before flagging.** If you are not at least
  80% sure a pattern is a real problem in this codebase's actual context
  (not just "this pattern is often bad"), don't flag it — or flag it at
  [Low confidence] with the specific uncertainty named, not silently omit
  the caveat.
- **Consolidate repeated findings.** The same anti-pattern hit five times in
  one file (e.g. five `Model.objects.all()` loops missing `select_related`)
  is **one finding with a count and all five locations listed**, not five
  separate findings. This keeps the report actionable instead of noisy.
- **Never flag CRITICAL on unchanged/pre-existing code.** If the review scope
  is a diff (the general skill's default) and the offending line existed
  before this change, cap it at MEDIUM and note it's pre-existing — CRITICAL
  is reserved for what this change introduces or what blocks this change from
  shipping safely. Pre-existing debt is real but it is not this PR's fault.

## Reflection gate addition

Before finalizing any lens finding, add one more check to the general
skill's Phase 3 Reflection pass: **does this project's own configuration or
convention already endorse this pattern?** Check, in order:
1. `CLAUDE.md` / `AGENTS.md` / `.cursorrules` at the repo root for an explicit
   statement that accepts the pattern (e.g. "we intentionally use `fields =
   '__all__'` on internal-only admin serializers").
2. The stack's own linter/formatter config (`.eslintrc*`, `ruff.toml` /
   `pyproject.toml [tool.ruff]`, `.flake8`) — a rule explicitly disabled with
   a comment explaining why is a documented exception, not a miss.
3. A code comment at the exact site explaining the deliberate choice.

If any of these explicitly endorse the pattern, do not flag it — or flag it
at INFO with "project convention, not re-litigating" rather than as a defect.
This is the same false-positive discipline the general skill's
`false-positive-catalogue.md` already applies; this is its stack-specific
extension.

## Provenance line convention

Every reference file under `references/` opens with a line naming its ECC
source agent(s) and fetch date, in the same form the general skill's lens
files already use:
`Adapted from ECC <agent-name>, fetched <date>.`
This is stated once here rather than repeated as commentary in each file.

## Reference files

| File | Detect | Requires |
|---|---|---|
| `references/react.md` | `package.json` has `react`/`react-dom` | — |
| `references/python.md` | any `.py` in scope | — |
| `references/python-fastapi.md` | FastAPI import in `main.py`/`app/main.py` | `python.md` |
| `references/python-django.md` | `manage.py` / `settings.py` | `python.md` |
| `references/python-django-celery.md` | `celery` dependency, or `celery.py`/`tasks.py` pattern | `python.md` + `python-django.md` |
| `references/nestjs.md` | `@nestjs/core`/`@nestjs/common` dependency, `nest-cli.json`, or Nest decorators | — |
| `references/angular.md` | `package.json` has `@angular/core` | — |
| `references/go.md` | `go.mod` at repo root, or any `.go` file in scope | — |
| `references/rust.md` | `Cargo.toml` at repo root, or any `.rs` file in scope | — |
| `references/vue.md` | `package.json` has `vue` (Nuxt sub-section loads automatically within the same file when `nuxt` is also present) | — |

**Status after the kelompok-1 follow-up analysis: Angular and NestJS are
active, proven lenses** (verified against Edho's real `ghostfolio` project,
an Nx monorepo running both), not speculative additions. **Go, Rust, and Vue
are FOLD-M** (kelompok 1 lanjutan): content is medium-depth and plausible,
ported straight from ECC's `golang-patterns`/`golang-testing`,
`rust-patterns`/`rust-testing`, and `vue-patterns`/`nuxt4-patterns`, but
**there is no evidence of an active Go, Rust, or Vue/Nuxt project in Edho's
workspace yet** — unlike Angular/NestJS (verified against `ghostfolio`) or
Python/React (already exercised elsewhere in this ecosystem). Treat these
three as ready-to-use lenses the moment a matching project shows up, not as
field-validated ones. Every other stack below is still planned, not built.
More stacks follow the same file shape and slot into the table above as
they're written — adding one doesn't require touching this SKILL.md beyond
the detection table. The 34-item DEFER backlog below (from the kelompok-1
follow-up analysis) is grouped by family with its own activation trigger and
review-specific notes — build-error handling for the same stacks lives in
`build-fix-edho-ferdian`'s own "Stacks planned" list, which is not identical
to this one since the two skills need different depth per stack.

## Stacks planned (not yet built) — review lens

Trigger for every group below is the same default: **a real project in that
stack appears in Edho's own work.** Until then these stay unbuilt rather than
speculatively written against no ground truth.

- **PHP/Laravel** (4 lenses: `laravel-patterns`, `laravel-security`,
  `laravel-tdd`, `laravel-verification`). Security criteria are **already
  ported** — `security-review-edho-ferdian/references/language-specific.md`
  §"PHP / Laravel [DEFERRED]" (from D-012). When this activates, write only
  the review/idiom, build/TDD, and verification sides; do not re-port the
  security content, just cross-reference it the way `python-django.md`
  cross-references its own SEC-08 move.
- **Java/Spring** (6 lenses: `springboot-patterns`, `springboot-security`,
  `springboot-tdd`, `springboot-verification`, `java-coding-standards`,
  `jpa-patterns`). Security is **already ported** —
  `security-review-edho-ferdian/references/language-specific.md` §"Java /
  Spring Boot [DEFERRED]" (from D-012), same rule: don't re-port security.
  `jpa-patterns` should land as a sub-section of
  `data-layer-patterns-edho-ferdian` when activated, not a standalone
  reference file — it's ORM/query depth, the same category that file already
  owns for other stacks.
- **Quarkus** (4 lenses: `quarkus-patterns`, `quarkus-security`,
  `quarkus-tdd`, `quarkus-verification`). Same trigger as Java/Spring;
  ~85% of the content is identical to Spring Boot. The D-012 precedent
  already treats Quarkus security as a sub-section of the Spring Boot
  section rather than its own top-level entry — keep that pattern for the
  review lens too when this activates: a Quarkus sub-section inside
  `references/java-spring.md`, not a separate `references/quarkus.md`.
- **Kotlin** (5 lenses: `kotlin-patterns`, `kotlin-testing`,
  `kotlin-coroutines-flows`, `kotlin-exposed-patterns`,
  `kotlin-ktor-patterns`). Trigger: a real Android, Kotlin Multiplatform, or
  Ktor project.
- **Swift/Apple** (4 lenses: `swiftui-patterns`, `swift-concurrency-6-2`,
  `swift-actor-persistence`, `swift-protocol-di-testing`). Trigger: a real
  iOS/macOS project. Note: Edho's environment is Windows 10 — the Swift
  toolchain itself doesn't run there, so this is the lowest-probability
  activation in the whole backlog, not just an unbuilt lens.
- **Mobile cross-platform** (5 lenses: `dart-flutter-patterns`,
  `flutter-dart-code-review`, `react-native-patterns`,
  `android-clean-architecture`, `compose-multiplatform-patterns`). Trigger:
  the first mobile project of any kind. When it fires, build
  `react-native-patterns` first — Edho is already on React/TypeScript, so
  that lens is the cheapest transfer of the five and should not wait for the
  others.
- **.NET** (3 lenses: `dotnet-patterns`, `csharp-testing`, `fsharp-testing`).
  Trigger: a real .NET project.
- **C++** (2 lenses: `cpp-coding-standards`, `cpp-testing`). Trigger: a real
  C++ project.
- **PyTorch** (1 lens: `pytorch-patterns`). Trigger: real PyTorch training
  code in scope. Generic ML review and the operational-lifecycle axis are
  **already covered** by `code-review-edho-ferdian/references/mle-lens.md`
  (from D-026) — what's
  actually missing here is narrow: framework mechanics only (tensor shape
  mismatches, device placement, AMP/mixed-precision correctness, DataLoader
  worker issues). `mle-lens.md`'s own "Handoffs" section already names this
  exact gap and defers to this future lens rather than guessing.
- **Perl** — **skipped permanently, not deferred.** `perl-patterns` and
  `perl-testing` are not planned at all; extend the existing explicit
  precedent in `security-review-edho-ferdian/references/language-specific.md`
  §"Perl — intentionally not built" (from D-012) to the patterns/testing side
  too if a Perl question ever comes up — don't write new Perl content, point
  at that section and its already-harvested generic findings (SEC-16..19).

## Provenance

This `SKILL.md` (the lens-layer orchestration itself — detection table,
relationship contract, confidence/reflection rules) is original scaffolding
written for this ecosystem, not a direct port of a single ECC skill or agent.
The per-stack content it orchestrates, however, is ported from ECC's
per-language reviewer agents, each with its own provenance line per the
convention above (fetched 2026-09-04): `references/react.md` from ECC
`react-reviewer`, `references/python.md` from ECC `python-reviewer`,
`references/python-fastapi.md` from ECC `fastapi-reviewer`,
`references/python-django.md` from ECC `django-reviewer`, and
`references/python-django-celery.md` from ECC `django-celery`,
`references/nestjs.md` from ECC `nestjs-patterns` (fetched 2026-09-06), and
`references/angular.md` from ECC `angular-developer` (SKILL.md + payload
references, fetched 2026-09-06). `references/go.md` is ported from ECC
`golang-patterns` + `golang-testing`, `references/rust.md` from ECC
`rust-patterns` + `rust-testing`, and `references/vue.md` from ECC
`vue-patterns` + `nuxt4-patterns` (all three fetched 2026-09-06, all three
FOLD-M — see the Reference files section above for what that means here).
See each reference file's own opening line for its individual fetch
confirmation.

## Language routing (inherited — see code-review-edho-ferdian, which points to skill-authoring-edho-ferdian's canonical contract)

Inherited, not restated — this lens has no report format of its own (see
"Relationship contract" above), so it follows whichever language routing
`code-review-edho-ferdian` is running under (itself pointing to
`skill-authoring-edho-ferdian` §7). Nothing to configure here.

## Global rules

1. **Lens, not a second review.** Always runs inside `code-review-edho-ferdian`'s
   phases, never standalone.
2. **No duplication.** Generic injection/secrets/nesting/magic-numbers/N+1
   stay owned by the general checklist; a lens adds only stack-specific depth.
3. **Detect by manifest, not extension**, and load every matching reference —
   stacks can combine.
4. **Ground-truth or Medium-cap.** Unverified findings never reach High.
5. **>80% confidence, consolidate repeats, never CRITICAL on pre-existing code.**
6. **Check project convention before flagging** — an explicitly endorsed
   pattern is not a defect.
7. **Provenance line in every reference file**, stated once here.
8. **34-item DEFER backlog stays deferred until its trigger fires** — see
   "Stacks planned (not yet built) — review lens" above; don't pre-build a
   lens for a stack with no ground truth in Edho's own work yet.
