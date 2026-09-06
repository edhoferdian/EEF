# Review Checklist, Severity, Report & Fix Formats

This is the detailed reference for Phases 1 and 5. Read it when you reach those
phases. Table of contents:

1. Domain 1 — Code Quality (CQ)
2. Domain 2 — Security (SEC)
3. Domain 3 — Performance (PERF)
4. Domain 4 — Blueprint / Consistency (BC)
5. Severity system & scoring
6. Report format (Phase 5)
7. Adaptive fix: Full Rewrite vs Patch
8. Changelog + clean-code standard + anti-hallucination guard
9. Saved `.md` report structure
10. Special scenarios

Domain 5 — Test Quality (TQ) lives in its own file,
`references/test-quality-lens.md`, since it has its own ground-truth
procedure (run the test suite / coverage tool) distinct from the static-read
approach of Domains 1–4. Conditional lenses (`database-lens.md`,
`accessibility-lens.md`, `rag-lens.md`) likewise live in their own files and
activate only when Phase 0 detects the relevant scope.

---

## 1. Domain 1 — Code Quality (CQ)

Baseline conventions this domain checks against — immutability, KISS/DRY/
YAGNI, size limits (functions <50 lines, files 200–400/800 max), naming
conventions, and comment discipline — are defined natively in
**`references/baseline-conventions.md`** (this ecosystem's own replacement
for the previously-inherited ECC global rule). Read it once; the codes below
cite it rather than re-deriving the same thresholds inline.

- **CQ-01 Single Responsibility** — does each function/component do exactly
  one thing? See `baseline-conventions.md` §3 for the size thresholds that
  usually signal a SRP violation.
- **CQ-02 Naming** — descriptive, non-misleading names? (avoid `data`, `temp`, `x`, `val`, `res`)
  Full naming-convention table (camelCase/PascalCase/UPPER_SNAKE_CASE/`is`-
  `has`-`use` prefixes) is `baseline-conventions.md` §6.
- **CQ-03 Hardcoded values** — values that belong in env/constants?
- **CQ-04 DRY** — repeated logic that should be abstracted into a reusable unit?
  - **CQ-04b Over-abstraction** — unwind over-abstracted single-use helpers: a
    function/class extracted for "reusability" that has exactly one call site
    and adds an indirection layer with no independent test value should be
    inlined back. DRY cuts both ways — a single-use abstraction isn't reuse,
    it's indirection. (Harvested from ECC `code-simplifier`.) `baseline-
    conventions.md` §2 adds one nuance on top: don't let a DRY extraction
    turn an isolated mutation into a shared one — see that section's
    immutability cross-note.
- **CQ-05 Error handling** — every async op has try/catch or a proper handler?
  Sub-codes CQ-05a..e (empty catch, masking fallbacks, lost propagation,
  logging quality, missing timeout/rollback) with mechanical ground-truth
  greps and severity guidance are in **`references/silent-failure-lens.md`**
  — read it whenever this checkbox surfaces anything beyond a trivial pass.
  The general principle ("handle at the layer that can act, never swallow
  silently") is `baseline-conventions.md` §4, which just points back here
  for the mechanics.
- **CQ-06 Typing** — types correct, no needless `any`? (where applicable)
  - **CQ-06b Type design** (typed languages only) — see below.
- **CQ-07 Dead code** — unused code, imports, or variables?
- **CQ-08 Comments** — explain *why*, not *what*? Over/under-commented?
  Sub-codes CQ-08a..d below. Default posture (comment only for WHY, never
  WHAT) is `baseline-conventions.md` §8.
- **CQ-09 Consistent style** — formatting/style consistent across the file?
- **CQ-10 Anti-patterns** — stack-specific anti-patterns present? In-place
  mutation of shared/passed-in values is a baseline anti-pattern regardless
  of stack — see `baseline-conventions.md` §1 (Immutability, CRITICAL).
- **CQ-11 Edge cases** — null, undefined, empty collections, boundaries handled?
- **CQ-12 Magic numbers** — unexplained numbers/strings that should be named
  constants? Same for deep nesting (>3–4 levels, prefer early returns) — both
  are `baseline-conventions.md` §7.

### CQ-06b — Type design (typed languages only)

Adapted from ECC `type-design-analyzer`, fetched 2026-09-04. Applies to
**domain/model types** — the types that encode business rules — not DTOs or
framework-required shapes (a Prisma-generated type, a form schema, an API
request/response wire type). Forcing this lens onto a DTO produces noise: a
DTO's job is to mirror an external shape, not to enforce invariants.

For each domain/model type in scope, check:

- **(a) Encapsulation** — can the type's invariants be violated from outside
  it (public mutable fields, no validation on construction)?
- **(b) Invariant expression** — do the types encode the actual business
  rules, and are impossible states unrepresentable (e.g. a `Draft | Published`
  union instead of a `status: string` plus a separate `publishedAt: Date |
  null` that can disagree with each other)?
- **(c) Invariant usefulness** — do the invariants the type enforces actually
  prevent real bugs relevant to this domain, or are they decorative
  type-safety theater with no bug-prevention value?
- **(d) Enforcement** — are the invariants enforced by the type system/
  compiler, or by a convention that's easy to bypass (a comment saying "don't
  mutate this directly", a constructor that can be skipped, a public setter
  that undoes the constructor's validation)?

### CQ-08 — Comments, sub-codes

Adapted from ECC `comment-analyzer`, fetched 2026-09-04.

- **CQ-08a Contradicts the code** (highest severity of the four — actively
  misleading) — the comment describes behavior the code does not actually
  have. Worse than no comment, because it actively misdirects the next
  reader.
- **CQ-08b Stale reference** — the comment references removed or renamed
  code, a parameter that no longer exists, or a behavior that was changed
  without updating the comment.
- **CQ-08c Undocumented debt** — a `TODO`/`FIXME`/`HACK` left with no tracking
  reference (issue link, ticket ID) and no context on why it's there or what
  finishing it requires.
- **CQ-08d WHAT instead of WHY** (low severity, informational) — a comment
  that restates what the code visibly does, when the only thing worth
  documenting is *why* it does it that way (a non-obvious constraint, a
  workaround for a specific bug, a business rule that isn't derivable from
  the code alone).

## 2. Domain 2 — Security (SEC)

**Security criteria now live in `security-review-edho-ferdian`** — that
skill is the single source of truth for all security review content in this
ecosystem (general OWASP-style checklist, plus stack-specific and
domain-specific security items), so nothing here duplicates it anymore.

For a quick pass, run the general checklist directly:
**SEC-01** Input sanitization/SSRF · **SEC-02** Secret exposure · **SEC-03**
Auth check · **SEC-04** Injection/race conditions (database-specific
concurrency → **SEC-04a..d**) · **SEC-05** IDOR · **SEC-06** Sensitive data
(PHI/PII/tokens never in URLs) · **SEC-07** Dependency risk · **SEC-08** Rate
limiting (+ stack-specific security items) · **SEC-09** CORS/CSRF ·
**SEC-10** Token handling · **SEC-11** Security misconfiguration · **SEC-12**
XXE/insecure deserialization · **SEC-13** Insufficient logging/monitoring —
full detail, ground-truth commands, and severity guidance for every one of
these codes are in `security-review-edho-ferdian/references/
general-checklist.md`. Load that file (or hand Domain 2 to the skill
directly) rather than re-deriving these from memory.

**For deeper, stack-aware coverage** (security-sensitive code — auth,
payments, user input, PHI; or whenever the user wants rigor), delegate to
`security-review-edho-ferdian` as Mode B ("delegated depth layer") instead of
relying on the checklist summary above alone — see that skill's `SKILL.md`
for the handoff contract. It also covers React/Python/FastAPI/Django
stack-specific security items (`references/language-specific.md`) and
database/healthcare/RAG/ML domain-specific security items
(`references/domain-specific.md`) that used to live inline in this skill's
own lens files.

## 3. Domain 3 — Performance (PERF)

- **PERF-01 N+1 query** — DB query inside a loop?
- **PERF-02 Unnecessary re-render** — components rendering more than needed? (frontend)
- **PERF-03 Missing memoization** — heavy computation that should be memoized/cached?
- **PERF-04 Blocking ops** — heavy sync work that should be async?
- **PERF-05 Memory leak** — listeners/timers/subscriptions not cleaned up?
- **PERF-06 Bundle size** — large imports replaceable with specific ones? (where applicable)
- **PERF-07 DB index** — queries hitting indexed fields? (where queries are visible)
  Database-specific query/schema findings from the conditional lens
  (composite index ordering, `SELECT *`, OFFSET vs cursor pagination, missing
  FK indexes, partial indexes, etc.) land as **PERF-07a..f** — see
  `references/database-lens.md`.
- **PERF-08 Payload size** — API returning more than the client needs?
- **PERF-09 Lazy loading** — large components/resources that could be lazy-loaded?
- **PERF-10 Async efficiency** — independent promises run sequentially instead of `Promise.all`?

**Escalation to measurement.** A PERF finding that requires actual
measurement to confirm — not just reading the code — should be escalated to
a dedicated `performance-audit-edho-ferdian` skill rather than asserted from
a static read. Examples: a suspected N+1 whose real
cost depends on production data volume, a suspected memory leak that needs a
heap-snapshot diff to confirm, a Core Web Vitals regression that needs a real
Lighthouse/RUM run. Report the suspicion with its reasoning and confidence
label as usual, but say explicitly that confirming it needs measurement this
skill doesn't perform, rather than asserting it as fact. (Harvested from ECC
`performance-optimizer`.)

## 4. Domain 4 — Blueprint / Consistency (BC)

**If a blueprint/spec is provided:**
- **BC-01 Feature completeness** — all blueprint features implemented?
- **BC-02 Business logic** — code logic matches the spec?
- **BC-03 Edge-case coverage** — blueprint edge cases handled in code?
- **BC-04 Naming consistency** — names match blueprint terminology?
- **BC-05 Data structure** — types/fields match the blueprint?
- **BC-06 Error-handling spec** — error handling matches the spec?
- **BC-07 Missing implementation** — any blueprint part not implemented at all?
- **BC-08 Over-implementation** — features beyond blueprint scope (scope creep)?

**If no blueprint:**
- **BC-01 Architectural consistency** — architectural patterns consistent throughout?
- **BC-02 Convention consistency** — naming conventions and folder structure consistent?
- **BC-03 Pattern consistency** — same pattern used for similar cases?

---

## 5. Severity system & scoring

Classify every finding on five levels:

- 🔴 **CRITICAL (10/10)** — crash, data leak, or direct security breach. Must fix;
  code must not ship until resolved.
- 🟠 **HIGH (7–9/10)** — serious issue affecting core function, significant
  security, or severe production performance. Fix before merge/deploy.
- 🟡 **MEDIUM (4–6/10)** — maintainability/efficiency/best-practice issue. Fix next iteration.
- 🔵 **LOW (1–3/10)** — minor issue, style, small tech debt. Backlog.
- ⚪ **INFO (0/10)** — non-urgent suggestion or observation.

**Overall score:** failed CRITICAL ×3 weight, failed HIGH ×2, failed MEDIUM ×1;
LOW/INFO don't affect score.
`Overall Score = (passed points / max points) × 10`.

Each finding also carries a **confidence label** from Phase 2
(`[High] / [Medium] / [Low — needs verification]`). Severity ≠ confidence: a HIGH
finding can be Low-confidence if it depends on runtime data you couldn't observe.

---

## 6. Report format (Phase 5)

Report in **English**. Present once, after Phases 0–4 are complete.

```
┌──────────────────────────────────────────────┐
│ 🔍 CODE REVIEW REPORT                          │
│ File(s)     : [name / module]                  │
│ Scope       : [whole file | git diff vs base]  │
│ Tech Stack  : [stack]                          │
│ Blueprint   : [Provided | Not provided]        │
│ Verified by : [tools run, or "reasoning only"] │
│ Date        : [date]                           │
│ Overall     : [X/10] — [CRITICAL/HIGH/…/CLEAN] │
├──────────────────────────────────────────────┤
│ SUMMARY                                        │
│ 🔴 Critical : [N]   🟠 High : [N]              │
│ 🟡 Medium   : [N]   🔵 Low  : [N]              │
│ ⚪ Info     : [N]   ✅ Passed: [N]             │
└──────────────────────────────────────────────┘
```

Per finding:

```
[DOMAIN-ID-###] 🔴/🟠/🟡/🔵/⚪ SEVERITY · [High/Medium/Low confidence] — Short title
Location : [file + line/function/variable]
Issue    : [specific problem]
Evidence : [the line/tool output that proves it]
Impact   : [what happens if left]
Fix      : [summary of the fix]
```

Then a **Top-5 Priority Fixes** block (id — title — why it's prioritized), a
**Reflection Notes** block (what was dropped/downgraded/merged in Phase 3 and why),
and a one-line **Critique-Correction outcome** (converged in N rounds; key
disputes, if any).

---

## 7. Adaptive fix: Full Rewrite vs Patch

After the report, proceed to fixes (don't wait for confirmation to *produce*
them; do confirm before *writing to files* in a repo).

**Mode A — Full Rewrite (file < 100 lines).** State: "This file is N lines —
Full Rewrite Mode." Output the entire corrected file, English names/comments,
header:
```
// FILE: [path]
// REVIEWED: [date]  MODE: Full Rewrite
// CHANGES: [N] fixed ([c] critical, [h] high, [m] medium, [l] low)
```
Rules: rewrite the whole file with all fixes applied; keep correct logic intact;
add no unrequested features; don't change behavior — only fix implementation;
no placeholders (must run as-is).

**Mode B — Patch (file ≥ 100 lines).** State: "This file is N lines — Patch Mode."
Per finding that needs a fix, show BEFORE/AFTER with a few lines of surrounding
context and a `// WHY` comment:
```
// FILE: [path]   PATCH: [ID] — [title]
// ─── BEFORE ───
[original problematic code with context]
// ─── AFTER ───
[fixed code]
// ─── WHY ───
[short reason]
```
Rules: rewrite only the affected span; include context for locating it; don't
refactor outside the finding; don't add features; every patch has a WHY.

Order fixes by severity (Critical → High → Medium). Low/Info optional.

## 8. Changelog + clean-code standard + anti-hallucination guard

**Changelog** (reasons in **Bahasa Indonesia**):
```
📝 CHANGELOG — [file] ([Full Rewrite | Patch])
[ID] Yang berubah : [perubahan spesifik]
     Baris        : [lama → baru, jika relevan]
     Alasan       : [mengapa diperbaiki]
```

**Clean-code standard** (enforce in both modes): single responsibility · no
`x/temp/data/res/val` names · no hardcoded values (constants/env) · error
handling on every async op · loading/empty/error states handled · comments only
for genuinely complex logic · no dead code/unused imports · complete, accurate
types where applicable.

**Anti-hallucination guard:** don't change already-correct business logic; if
unsure of the right implementation, write `// TODO: Verify this implementation —
[reason]`; for specific library/API calls, `// Note: Verify latest API syntax
before deployment`. Prefer verifying in Phase 2 over guessing.

## 9. Saved `.md` report structure

Write to the repo (e.g. `./<file-or-module>-code-review.md`) and tell the user
the path. Structure (English):

```
# Code Review Report — [File/Module]
**Date** · **Tech Stack** · **Scope** · **Blueprint** · **Verified by**
**Overall Score**: [X/10] — [category]
**Reviewer**: Edho Ferdian Code Review Mode (Skill Edition)

## Summary            (severity table)
## Findings           (full findings with confidence labels + evidence)
## Top 5 Priority Fixes
## Reflection Notes    (Phase 3 — dropped/downgraded/merged + why)
## Critique-Correction Outcome  (Phase 4 — rounds, disputes, resolution)
## Revised Code        (full rewrite) OR ## Patches (patch mode)
## Changelog           (reasons in Bahasa Indonesia)
## Re-review Checklist (re-run when: business logic changed · new dependency ·
                        DB/API structure changed · before merge to main/prod)
```

## 10. Special scenarios

- **Module mode (multi-file):** review each file (each picks its own fix mode by
  length), then add a consolidated report with cross-file findings
  (inconsistencies between files) and one combined `.md`. In an agentic context
  you don't need to pause for confirmation between files — process them, then
  summarize; pause only before writing fixes to disk.
- **Very long file (500+ lines):** review by section (Imports & Constants · Types
  & Interfaces · Main Logic · Helpers · Exports), then present the full result.
- **Incomplete/unparseable code:** if the code is truncated, say exactly what's
  missing and that partial review yields unreliable findings; ask for the
  complete file rather than guessing.
