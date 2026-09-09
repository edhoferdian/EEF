---
trigger: model_decision
description: "Rapid, adversarial-loop prototyping and design iteration: a Plan → Generate → Evaluate/iterate cycle where a generator builds a live app and an evaluator drives it in a real browser, scores it against a weighted design rubric, and feeds concrete fixes back until a quality threshold is crossed or a max-iteration cap is hit. The Plan phase never invents scope from a one-line prompt — it pulls features from a real source (dev-kickoff-edho-ferdian's Project Decision Register or spec-mining-edho-ferdian's mined specs), or proposes a small, explicitly unapproved exploratory scope when no spec exists at all. Use when the user wants fast UI/prototype iteration with automated design critique, says \"gan-harness\", \"loop generate-evaluate\", \"iterate sampai bagus\", \"buat prototipe cepat lalu nilai\", or wants a live app scored and improved automatically. Not a substitute for dev-kickoff-edho-ferdian's IMPLEMENT stage on production feature work — this is the faster/looser prototyping variant."
---

# GAN Harness — Edho Ferdian Mode (Skill Edition) · v1.0

You are running a three-phase adversarial loop — Plan, Generate, Evaluate —
to rapidly build and refine a prototype or design iteration. This is
deliberately **faster and looser** than `dev-kickoff-edho-ferdian`'s six-stage
PLAN → TEST → IMPLEMENT → REVIEW → VERIFY → REMEMBER loop: no test-first
discipline, no full Reflection/CCL gate machinery, no project-memory sync
after every task. Use this when the goal is exploring what an app or a
screen *could look like*, iterating fast on craft and design — not when the
goal is a production feature with correctness guarantees. If the user's
actual need is production feature work, point them at
`dev-kickoff-edho-ferdian` instead of running this loop on it.

## The one deviation that matters most: where the Plan phase gets its scope

The original `gan-planner` concept takes a one-line prompt and is explicitly
instructed to **"be deliberately ambitious"** — invent 12-16 features,
push scope beyond what was asked, because "conservative planning leads to
underwhelming results." That is a direct contradiction of this ecosystem's
ground-truth ethos: real specs, real tool output, never fabricate scope that
nobody asked for and call it a plan.

**This skill replaces that behavior.** The Plan phase never invents a
feature list from nothing. It pulls scope from one of three sources, in this
priority order:

1. **An already-kicked-off project** (`/project-memory/01-decision-register.md`
   exists, written by `dev-kickoff-edho-ferdian`) → the feature/requirement
   list comes from the Decision Register's binding decisions and any
   Provisional Task Plan, not from re-imagining the product.
2. **A brownfield codebase with mined specs**
   (`/project-memory/mined-specs/*.md`, written by `spec-mining-edho-ferdian`)
   → the feature list is the set of Requirements/Invariants already
   extracted from the real, running code. Iterate the UI/UX around behavior
   that's already there.
3. **Neither exists, and the user explicitly wants pure exploratory
   prototyping** → the Plan phase may propose a **small** scope (not
   12-16 features — think 3-5, sized to what a single fast iteration loop
   can meaningfully evaluate), labeled unmistakably
   `[EXPLORATORY — NOT APPROVED]`, and gated behind the same approval
   requirement as `dev-kickoff-edho-ferdian`'s own Provisional Task Plan:
   the user must approve, reject, or amend it before Generate starts.
   Never treat an exploratory scope as if it were derived from real
   requirements, and never let its language drift toward sounding
   authoritative after a few iterations.

Full mechanics, templates, and the decision tree for which source applies:
**`references/spec-and-plan.md`**.

## The three phases

```
Phase 1  Plan       — derive scope from a real source (see above) → references/spec-and-plan.md
Phase 2  Generate    — build/iterate the live app                  → references/generate-phase.md
Phase 3  Evaluate    — drive the live app, score, feed back, loop   → references/evaluate-phase.md
```

### Phase 1 — Plan

Produce a spec document and a rubric, same shape as the original concept
(`spec.md` + `eval-rubric.md`, or equivalent paths inside this project's
`gan-harness/` working directory), but sourced per the priority order above
instead of invented. See `references/spec-and-plan.md` for the exact
decision tree, source-reading rules, and the `[EXPLORATORY — NOT APPROVED]`
template.

### Phase 2 — Generate

Build fast, commit per
iteration, keep a dev server running, read the Evaluator's feedback file
before every iteration after the first, fix issues in the priority order
functionality → craft → design → originality. This phase conceptually maps
onto `dev-kickoff-edho-ferdian`'s IMPLEMENT stage, but stays a **separate,
faster/looser variant here** rather than merging into it: no test-first
requirement, no per-task Reflection block, commits are iteration checkpoints
rather than reviewed units of work. Full workflow, state-file format, and
the "avoid AI slop" quick-reference: **`references/generate-phase.md`**
(the full craft checklist lives in `references/frontend-craft-checklist.md`,
cross-referenced from there). When the app being built is a React/Next.js
UI, also pull the matching authoring reference from
`frontend-engineering-edho-ferdian` (`design-direction.md`, `ui-polish.md`,
`motion-system.md`, `composition-and-ux.md`, `accessible-authoring.md`) —
the checklist tells you *what* to fix; that skill's references tell you
*how* to build it right the first time, cutting iteration count instead of
relying on the Evaluate phase to catch it.

### Phase 3 — Evaluate

Drives the **live running app** (not a code read) via whatever browser-
automation driver is actually available — detect at runtime, same
requirement as `e2e-testing-edho-ferdian`: do not hardcode one preferred
tool (Playwright MCP was the original's only option; this ecosystem may also
have Chrome DevTools MCP, `windows-desktop-e2e`, or another driver installed).
Scores against the weighted rubric:

```
weighted = (design * 0.3) + (originality * 0.2) + (craft * 0.3) + (functionality * 0.2)
```

Iterates until the weighted score crosses **7.0** or a max-iteration cap is
hit (default 5 — confirm with the user for anything that could run
unattended longer). **Evaluation-mode honesty is mandatory**: the feedback
file records the mode *actually achieved* — `live-driver`, `screenshot`, or
`code-only` — never the mode that was merely requested. If driving the live
app fails and the phase silently falls back to a static code read, that must
be stated as a `code-only` result, not scored as if a live evaluation
happened. Full driver-detection procedure, scoring calibration, feedback-file
format, and the iteration/stop-condition rules: **`references/evaluate-phase.md`**.

## Relationship to other skills in this ecosystem

- **`dev-kickoff-edho-ferdian`** — the source of real scope for Plan
  Priority 1, and the skill to use instead of this one for production
  feature work with correctness guarantees (test-first, full Reflection/CCL,
  project-memory sync). This skill's Generate phase is intentionally a
  faster/looser cousin of dev-kickoff's IMPLEMENT stage, not a replacement.
- **`spec-mining-edho-ferdian`** — the source of real scope for Plan
  Priority 2, when iterating on UI/UX for an existing brownfield codebase
  that has no written spec.
- **`e2e-testing-edho-ferdian`** — shares the runtime driver-detection
  requirement with this skill's Evaluate phase; if that skill has already
  established which driver is available in this session/project, reuse that
  finding instead of re-detecting.
- **`code-review-edho-ferdian`** — the frontend-craft "AI-slop" audit
  content preserved in `references/frontend-craft-checklist.md` is generic
  frontend-quality signal, not specific to the GAN loop. It is a candidate
  future lens for `code-review-edho-ferdian` (a conditional lens active when
  scope touches UI/component code, same pattern as the existing
  accessibility/RAG lenses there). **This is a note for a future task, not
  an edit made here** — `code-review-edho-ferdian` is out of scope for this
  skill's build.

## Guardrails

1. **Never invent scope.** Plan phase sources are ranked above; an
   exploratory scope is always labeled `[EXPLORATORY — NOT APPROVED]` and
   gated on user approval, never silently promoted to "the plan."
2. **Never silently downgrade the evaluation mode.** Record what was
   actually achieved; a failed live-driver attempt is a `code-only` or
   `screenshot` result, reported as such.
3. **Detect the driver, don't hardcode it.** Same rule as
   `e2e-testing-edho-ferdian`.

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user (Plan/Generate/Evaluate narration, feedback to the
Generator) in Bahasa Indonesia; generated code, spec documents, and
evaluator reports in English — fixed, never ask. Full contract:
`skill-authoring-edho-ferdian` §7.
4. **This is not dev-kickoff.** Don't pull this skill's looser discipline
   into production feature work, and don't pull dev-kickoff's heavier
   discipline into a fast prototyping loop where it isn't wanted — name
   which mode you're in when starting.
5. **Iteration has a cap.** Never loop unbounded; confirm the max-iteration
   count with the user if it isn't the 5-iteration default, and stop and
   report honestly if the threshold isn't reached by the cap rather than
   quietly extending it. Before starting a loop, or if one is behaving
   oddly (spinning, score climbing while the app looks worse, scope
   drifting), run the Gate 0 checklist and failure-mode guards in
   **`references/loop-design-review.md`** — the iteration cap alone bounds
   cost, it doesn't catch a badly-designed loop.

**Done criteria for a full run:** scope sourced and labeled per the priority
order (never invented) · Generate produces a live, running app with commits
per iteration · Evaluate reports the mode actually achieved every round ·
loop stops at threshold (≥7.0) or max-iteration cap, whichever comes first,
with an honest final report either way.
