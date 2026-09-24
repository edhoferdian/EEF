# Baseline Coding Conventions — Edho Ferdian Ecosystem

## Provenance & why this file exists

This file closes decision-register debt **D-005**: until now, the *floor*
this ecosystem's code-quality reviews stood on — immutability, KISS/DRY/
YAGNI, size limits, naming, comment discipline — was not owned by this
ecosystem at all. It was inherited silently from a file that lives outside
this repo: `~/.claude/rules/ecc/common/coding-style.md`, installed globally <!-- d034-ok: historical mention, not a live pointer -->
at the user level. That file in turn is a compressed pointer to further
upstream coding-standards material.

The practical risk: if that global install is ever removed, updated in an
incompatible way, or simply not present on a machine this ecosystem runs on
(a fresh clone, a CI runner, a teammate's setup), every review this skill
produces silently loses its baseline code-quality vocabulary — CQ-01
through CQ-12 in `review-checklist.md` reference concepts (immutability,
naming conventions, size limits) that were never actually *defined* inside
this repo. Nothing would error; the reviews would just quietly get shallower.

This file is the fix: a **native, in-repo restatement** of that baseline,
written for this ecosystem rather than copied from an external source. It
draws on both the local `coding-style.md` rule file and further upstream
coding-standards material, but is not a literal port —
wording, examples, and emphasis are rewritten, and every section that
already has a canonical home elsewhere in this ecosystem is a pointer, not a
restatement (see §10). Going forward, `review-checklist.md`'s CQ codes cite
*this* file as their baseline, not the external rule.

If that global rules install is ever uninstalled, this file — not
`~/.claude/rules/ecc/common/coding-style.md` — is the ground truth for what <!-- d034-ok: historical mention, not a live pointer -->
"clean code" means in this ecosystem's reviews.

---

## 1. Immutability (CRITICAL)

Default to creating new values, not mutating ones that already exist.

```
// Pseudocode
WRONG:   modify(original, field, value)   // changes original in place
CORRECT: update(original, field, value)   // returns a new copy with the change
```

Why this is CRITICAL and not just a style preference: a mutated object can
be read by another part of the system (a closure, a parent component, a
concurrent handler) *before* the mutation is visible to it and *after* — the
two reads disagree, and the bug that causes shows up far from the mutation
site, which is what makes it expensive to debug. Returning a new value
instead removes that class of bug entirely: nothing holding a reference to
the old value is surprised by it changing under it.

This applies at every layer — state updates, array/object transforms, and
shared config/cache objects — not only to UI framework state. A CQ-01/CQ-10
finding that traces back to an in-place mutation of a shared value should
cite this section as the standard being violated.

## 2. KISS, DRY, YAGNI

- **KISS** — ship the simplest solution that actually satisfies the
  requirement. Cleverness that isn't necessary for the requirement is a
  liability, not a virtue: it costs the next reader time to convince
  themselves it's correct. Don't optimize before a real bottleneck is
  measured — see `performance-audit-edho-ferdian` for how "real" is
  established.
- **DRY** — extract logic that repeats for a real, current reason, not a
  guessed future one. **This ecosystem's canonical DRY criterion is already
  defined in `review-checklist.md` under CQ-04 (and its CQ-04b
  over-abstraction counterpart) — do not restate DRY's definition here.**
  The nuance this file adds on top: DRY and immutability interact — when
  extracting a shared helper that touches state, make sure the extraction
  doesn't turn what was an isolated mutation into a *shared* one now
  reachable from two call sites. That's a strictly worse bug than the
  duplication it removed.
- **YAGNI** — an abstraction, a config flag, or a generalized interface
  earns its place when a second real caller exists or is imminently
  scheduled, not when it's merely plausible one might show up. A single-use
  "just in case" abstraction is CQ-04b's over-abstraction case, viewed from
  the authoring side instead of the review side.

## 3. Size limits & organization

- Functions: aim under 50 lines. Past that, the function is very likely
  doing more than one job — split along its actual responsibilities, not at
  an arbitrary line count.
- Files: 200–400 lines is the healthy range; 800 is a **soft maintainability
  ceiling** for source files. A source file past 800 lines is a signal to
  extract a module — but it is a MEDIUM finding only when the size is
  *unexplained*. Test files, generated code, vendored code, and fixture data
  may legitimately exceed the ceiling when their size follows from their
  role; note the reason rather than splitting them to satisfy a number.
- Organize by feature/domain (`orders/`, `billing/`), not by technical type
  (`controllers/`, `helpers/`) — code that changes together should live
  together so a single feature change doesn't require touching five
  unrelated top-level folders.

A CQ-01 (single responsibility) finding on an oversized function or file
should point to this section for the numeric thresholds rather than
asserting a limit ad hoc.

## 4. Error handling

Handle errors explicitly at the layer that can actually do something useful
with them — don't let a low-level failure surface as a generic, uninformative
error three layers up, and don't swallow it silently either. User-facing
code needs a message a human can act on; server-side code needs enough
context in the log to reconstruct what happened without reproducing it live.

**This ecosystem's detailed silent-failure criteria (empty catch blocks,
masking fallbacks, lost propagation, ground-truth grep patterns, severity
guidance) already live in `silent-failure-lens.md` under CQ-05 — that file
is authoritative for error-handling findings, not this section.** This
section states the principle; that file states the mechanics.

## 5. Input validation at boundaries

Validate everything crossing a trust boundary — an HTTP request body, a file
read from disk, a third-party API response, a message off a queue — before
it's treated as trusted data inside the system. Prefer schema-based
validation (a Zod/Pydantic/JSON-Schema-style definition) over ad hoc
`if` checks, because a schema is one place to look and one place to update.
Fail fast with a specific error rather than letting invalid data travel
deeper into the system where the eventual failure is harder to trace back to
its source.

**Where this overlaps security** — unsanitized input reaching a query,
a path, or a shell call — that is `security-review-edho-ferdian`'s
territory (SEC-01 and related codes in
`security-review-edho-ferdian/references/general-checklist.md`). This
section covers validation as a correctness/robustness discipline; don't
duplicate the SEC-numbered security criteria here — cite that skill instead.

## 6. Naming conventions

- Variables and functions: `camelCase`, descriptive enough that the name
  alone tells you what it holds or does. Names like `data`, `temp`, `val`,
  `res`, `x` are CQ-02 findings, not acceptable placeholders.
- Booleans: prefix with `is`, `has`, `should`, or `can` (`isLoading`,
  `hasPermission`) so a reader never has to guess the polarity.
- Interfaces, types, and components: `PascalCase`.
- Constants: `UPPER_SNAKE_CASE`.
- Custom hooks: `camelCase` with a `use` prefix (`useDebounce`,
  `useAuthState`) — this is React's own convention (the rules of hooks
  depend on the `use` prefix being present), not merely a style choice.

## 7. Code smells

- **Deep nesting** — past 3–4 levels of nested conditionals, switch to early
  returns / guard clauses. A function that reads top-to-bottom as a list of
  "bail out if not X" checks is easier to verify than one shaped like a
  staircase.
- **Magic numbers** — any number or string whose meaning isn't obvious at
  the call site (a retry count, a timeout, a threshold) becomes a named
  constant. The constant name carries the meaning; the literal doesn't.
- **Long functions** — see §3. Splitting is not optional past the line
  threshold; it's the fix.

## 8. Comment discipline

Default posture: **no comment**. A well-named function and well-named
variables should make the *what* self-evident; a comment restating what the
next line already says (CQ-08d in `review-checklist.md`) is noise that can
go stale.

Write a comment only when it explains a **WHY** that the code cannot express
on its own:

- a non-obvious constraint ("this must run before X because the upstream
  API rate-limits at Y")
- a workaround for a specific, named bug ("Safari drops this event without
  the timeout — see issue #123")
- a business rule that isn't derivable by reading the logic alone ("refunds
  under $5 skip manual review per finance policy")

If you find yourself writing a comment that describes *what* the next line
does, delete the comment and improve the name instead. The full taxonomy of
comment failure modes (contradicts the code, stale reference, undocumented
`TODO`/`FIXME`, WHAT-not-WHY) is CQ-08's sub-codes in `review-checklist.md`
— this section is the authoring-side rule those review codes check against.

---

## 9. Quick checklist

Before calling code-quality-clean, confirm:

- [ ] No in-place mutation of shared/passed-in values (§1)
- [ ] Simplest solution that satisfies the actual requirement (§2)
- [ ] Real repetition extracted; no single-use "reusable" abstractions (§2,
      cross-ref CQ-04/CQ-04b)
- [ ] Functions < 50 lines; files 200–400 typical, 800 soft ceiling —
      unexplained overage is MEDIUM, explained overage (tests/generated/
      vendored/fixtures) is not a finding (§3)
- [ ] Errors handled at the right layer, nothing silently swallowed (§4,
      cross-ref `silent-failure-lens.md`)
- [ ] All boundary input validated against a schema, not ad hoc checks (§5)
- [ ] Naming follows camelCase/PascalCase/UPPER_SNAKE_CASE/`is`-`has`-`use`
      conventions (§6)
- [ ] No nesting past 3–4 levels; no unnamed magic numbers (§7)
- [ ] Comments explain WHY only, not WHAT (§8)

---

## 10. Already owned elsewhere — do NOT duplicate here

This file is the generic, framework-agnostic floor. Anything stack-specific
or domain-specific already has a canonical home in this ecosystem; if you're
tempted to add it here, add a pointer instead:

- **React/Next.js authoring patterns** (component composition, state
  placement, data-fetching, hooks design, Server/Client Component
  boundaries) — `frontend-engineering-edho-ferdian`, especially
  `references/react.md`. This file does not restate React idioms; §6's
  `use`-prefix rule is the only React-adjacent detail it states, and only
  because it's a general naming-convention fact, not a React pattern.
- **REST conventions, response envelope shape, status-code semantics,
  versioning/contract-evolution policy** — `api-design-edho-ferdian`,
  `references/rest-conventions.md` and `references/contract-evolution.md`.
  This file does not define what a good API response shape looks like.
- **Memoization, re-render avoidance, bundle size, and other
  measured-performance patterns** — `performance-audit-edho-ferdian` (for
  measure-then-fix work) and `review-checklist.md`'s PERF-01..10 (for the
  static read-time check). This file's §2 KISS note about not
  pre-optimizing is the only performance-adjacent statement it makes.
- **Security-sensitive validation (injection, IDOR, secret exposure, auth)**
  — `security-review-edho-ferdian`. §5 here covers validation as a
  correctness discipline; it is not a security checklist.
- **DRY's full definition and the over-abstraction counter-case** —
  `review-checklist.md` CQ-04/CQ-04b, cited from §2 rather than repeated.
- **Silent-failure mechanics (grep patterns, confidence rules)** —
  `silent-failure-lens.md`, cited from §4 rather than repeated.
