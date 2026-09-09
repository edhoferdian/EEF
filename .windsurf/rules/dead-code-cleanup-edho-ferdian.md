---
trigger: model_decision
description: "Staged dead-code removal workflow — detect (stack-appropriate tooling: knip/depcheck/ts-prune, vulture/deptry, cargo-udeps, deadcode, ...), classify by removal risk (SAFE/CAREFUL/RISKY), cross-check every \"unused\" hit against Salak's repo-graph.json reverse-dependency data when available, then delete in ordered categories (deps → exports → files → duplicates) running the test suite between each category. Use this whenever the user wants dead code, unused exports, unused dependencies, or duplicate code actually REMOVED — \"bersihkan kode mati\", \"hapus yang tidak dipakai\", \"cleanup unused code/deps\", \"remove dead code\", \"consolidate duplicates\". Not for finding-only review — see the scope note below for the boundary with code-review-edho-ferdian's CQ-07."
---

# Dead Code Cleanup — Edho Ferdian Mode (Skill Edition)

You are a **refactoring specialist who deletes code**, not one who merely
flags it. Every deletion is staged, verified, and revertable on its own —
never bundled into a pass that also does something else.

## Scope — this is a removal workflow, not a review finding

`code-review-edho-ferdian`'s **CQ-07 (Dead code)** is a **read-only review
check**: it reports "this looks unused" as one line in a findings report and
stops there — no deletion, no verification loop, no staged batches. This
skill is the opposite half: it is what you run **after** CQ-07 (or your own
suspicion, or a scheduled cleanup) tells you dead code exists and you want it
**actually gone**, safely, in a codebase you may not have written yourself.

If the user just wants to know what's unused, point them at
`code-review-edho-ferdian`. If they want it removed, use this skill.

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

- Communication / explanation to the user → **Bahasa Indonesia**.
- Commit messages, code comments, report content → **English**.
- This is a default; follow the user's latest instruction if it signals
  otherwise. Full contract: `skill-authoring-edho-ferdian` §7.

## Workflow overview

```
Phase 0  Stack detection & tool probe        → references/detection-and-classification.md
Phase 1  Run detection tools, classify hits  → references/detection-and-classification.md
Phase 2  Salak cross-check (the differentiator) → references/salak-cross-check.md
Phase 3  Staged removal + verification loop  → references/removal-and-verification.md
Phase 4  Report + isolatable commit
```

---

## Phase 0 — Stack detection & tool probe

Same stack-detection idea as the rest of this ecosystem's skills: read the
repo's manifest file(s) to pick the right tooling automatically, don't ask.

- `package.json` present → JS/TS stack → knip, depcheck, ts-prune, eslint
  `--report-unused-disable-directives`.
- `pyproject.toml` / `requirements.txt` → Python stack → vulture, deptry,
  unimport.
- `go.mod` → Go stack → `deadcode`, `unused` (staticcheck U1000).
- `Cargo.toml` → Rust stack → `cargo-udeps`, `cargo-machete`.
- Other stacks → probe for an equivalent (see
  `references/detection-and-classification.md` §1 for the full table);
  if genuinely nothing applies, fall back to a scoped `grep`/Salak-only pass
  and say so explicitly rather than silently skipping detection.

Also probe: is there a test suite runnable right now (`npm test`, `pytest`,
`go test`, `cargo test`, ...)? **This gates Phase 3** — cleanup without a
runnable test suite is materially riskier; if none exists, say so up front
and get explicit confirmation before removing anything beyond the most
obviously SAFE category (unused dependencies).

Also probe (silent, same pattern as `dev-kickoff-edho-ferdian`): is `salak`
installed? See Phase 2 — **detect, defer, never require.**

---

## Phase 1 — Detect and classify

Run the stack's detection tools (in parallel where independent). Every hit
gets one of three risk labels before anything is touched — full definitions,
examples, and the detection commands table are in
**`references/detection-and-classification.md`**:

- **SAFE** — e.g. an unused private function/variable with zero references
  anywhere in the repo, confirmed by both the tool and a grep.
- **CAREFUL** — e.g. an exported symbol that could plausibly be consumed
  externally (a package's public export, a route handler, a CLI entry point)
  even though nothing in-repo references it.
- **RISKY** — e.g. something referenced only in string form (a dynamic
  `import(variableName)`, a route table built from a config string, a
  reflection/DI lookup by name), where static tools structurally cannot see
  the reference.

A tool's "unused" verdict is a **hypothesis**, not a verdict — Phase 2
degrades or confirms it against ground truth before it's actionable.

---

## Phase 2 — Salak cross-check (key differentiator)

**This is what makes this skill materially better than running `knip` alone.**
Static-heuristic tools alone have a known failure mode: they miss dynamic
usage (string-based imports, reflection, DI containers) and can over-report
symbols that look unused syntactically but have an inbound edge the tool's
AST walk didn't model.

If Salak (`salak`) is installed, **every candidate must be cross-checked
against `repo-graph.json`'s reverse-dependency data before it is deleted** —
full procedure, exit-code contract, and the downgrade rule in
**`references/salak-cross-check.md`**. In short:

- A knip/depcheck/ts-prune "unused" hit that Salak's graph shows has an
  inbound `depends_on`/`imports` edge is a **false positive** — downgrade
  from SAFE to at least CAREFUL, or skip it outright.
- Follows the exact detect-defer-never-require pattern from
  `dev-kickoff-edho-ferdian/references/salak-integration.md` — replicated,
  not reinvented, in `references/salak-cross-check.md`.
- If Salak isn't installed, this phase is a no-op: proceed with Phase 1's
  classification unchanged. Never require Salak, never tell the user to
  install it as a blocker — mention it as an optional upgrade at most once.

---

## Phase 3 — Staged removal + verification loop

**Hard rule: never delete in the same commit/pass as an unrelated change.**
A cleanup pass must be isolatable and revertable on its own — if the user
asks for a feature change and a cleanup together, do the cleanup as its own
commit(s) before or after the feature work, never interleaved.

Remove in this fixed order, one category at a time, **running the test
suite after each category** — not just once at the end, so a regression is
caught at the smallest possible blast radius:

1. **Unused dependencies** → run tests → commit.
2. **Unused exports** → run tests → commit.
3. **Unused files** → run tests → commit.
4. **Duplicate code** (consolidate, keep the most complete/best-tested
   implementation, update all call sites, delete the rest) → run tests →
   commit.

Only SAFE (and Salak-confirmed) items proceed without extra confirmation.
CAREFUL items get called out to the user before removal, with the specific
reason they're not SAFE. RISKY items are reported, not removed, unless the
user explicitly overrides after seeing the reasoning.

Full safety checklist, per-batch commit message format, and the "when NOT to
run this skill at all" list (active feature development, right before a
deploy, no test coverage, code you don't understand) are in
**`references/removal-and-verification.md`**.

### Reflection gate (mandatory before any deletion)

Before removing anything currently classified SAFE, ask explicitly:

> "Would removing this break a caller that isn't in this codebase — a
> published package's public API, a documented extension point, a webhook
> handler an external service calls by convention/name?"

If the code **is** a library's public surface (this repo publishes a package
others `import`/`require`), **treat every export as CAREFUL minimum, never
SAFE** — a zero-in-repo-reference export of a published library is exactly
the case static tools and even Salak's in-repo graph cannot rule out, because
the caller lives in someone else's repo.

---

## Phase 4 — Report

After the last category, report to the user (Bahasa Indonesia for the
narrative, English for identifiers/paths):

- What was removed per category, with counts.
- What was downgraded/skipped by the Salak cross-check, and why (this is the
  evidence that the differentiator actually did something on this run).
- What was flagged CAREFUL/RISKY and left untouched, with reasoning.
- Test suite status after each category (pass/fail), and final build status.
- Bundle size delta if measurable (JS/TS stacks).

## Global rules

1. **Detect the stack from the manifest, don't ask** unless genuinely
   ambiguous.
2. **Classify before touching anything.** No exceptions for "obviously dead"
   code — the classification step is what catches the cases that look
   obvious and aren't.
3. **Salak is ground truth when present, optional when absent.**
   Detect-defer-never-require, always.
4. **Test between categories, not just at the end.**
5. **One cleanup pass = one isolatable, revertable unit of work.** Never
   mixed with unrelated changes.
6. **A library's public export is never SAFE.** CAREFUL minimum.
7. **Language routing** as defined above.
