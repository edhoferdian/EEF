---
trigger: model_decision
description: "Language- and framework-specific code review lenses layered on top of the general four-domain review in code-review-edho-ferdian — idioms, framework security misconfigurations, ORM/query correctness, performance traps, and testing conventions, auto-detected across ~20 stacks (React, Python, Go, Java/Spring, Ruby, and more — see the reference table below for the full list). Use whenever a review touches a specific language/framework and the generic checklist isn't enough — \"review kode Go/Python/React ini\", \"audit Django models\", \"cek FastAPI endpoint ini\", or when the user names a stack while asking for review. Loads only the lens file(s) matching the detected stack. Inherits Reflection and Critique-Correction gates from code-review-edho-ferdian."
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
| `references/laravel.md` | `composer.json` has `laravel/framework` | — |
| `references/java-spring.md` | `pom.xml`/`build.gradle*` has a `spring-boot` dependency, or `@SpringBootApplication` present (Quarkus sub-section loads within the same file when `quarkus` dependencies are present instead) | — |
| `references/kotlin.md` | any `.kt`/`.kts` file in scope, or `build.gradle.kts` | — |
| `references/swift.md` | `Package.swift`, or any `.xcodeproj`/`.xcworkspace` | — |
| `references/react-native.md` | `package.json` has `react-native` | `references/react.md` |
| `references/flutter.md` | `pubspec.yaml` has a `flutter` dependency | — |
| `references/android.md` | `AndroidManifest.xml` present, or a Gradle module applying the Android plugin | — |
| `references/compose-multiplatform.md` | `build.gradle.kts` has `org.jetbrains.compose` | `references/android.md` |
| `references/dotnet.md` | any `.csproj`/`.fsproj`/`.sln` file | — |
| `references/cpp.md` | `CMakeLists.txt`, or any `.cpp`/`.hpp`/`.cc` file in scope | — |
| `references/pytorch.md` | `torch` import or dependency in scope | `code-review-edho-ferdian/references/mle-lens.md` |
| `references/perl.md` | any `.pl`/`.pm`/`.t` file, or `cpanfile`/`Makefile.PL`/`.perlcriticrc` at repo root | — |

> **Truncated for Windsurf's 12,000-character workspace rule limit.** Read the full skill at `skills/language-code-review-edho-ferdian/SKILL.md` for complete instructions.
