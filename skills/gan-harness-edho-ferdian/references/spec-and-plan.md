# Plan phase — sourcing scope for real (the adapted phase)

This is the phase ECC's `gan-planner` handled by inventing 12-16 features
from a one-line prompt with the explicit instruction to "be deliberately
ambitious." That instruction is dropped entirely. What follows replaces it.

## Decision tree — where does scope come from?

Run these checks in order. Use the **first** one that applies; do not mix
sources within one Plan run (if a project later grows a Decision Register
mid-loop, that's a new Plan run, not a silent scope change).

```
1. Does /project-memory/01-decision-register.md exist in this project,
   written by dev-kickoff-edho-ferdian?
   → YES: Source A (Decision Register). Go to §Source A.
   → NO: continue.

2. Does /project-memory/mined-specs/*.md exist, written by
   spec-mining-edho-ferdian?
   → YES: Source B (mined specs). Go to §Source B.
   → NO: continue.

3. Neither exists. Does the user explicitly want pure exploratory
   prototyping with no real spec behind it?
   → YES: Source C (exploratory, gated). Go to §Source C.
   → NO: stop. Tell the user neither a kicked-off project nor mined specs
     were found, and ask whether to run spec-mining-edho-ferdian first
     (if there's existing code to mine), dev-kickoff-edho-ferdian first
     (if there are specs to kick off from), or proceed exploratory (Source C)
     knowingly.
```

## Source A — Decision Register (already-kicked-off project)

1. Read `/project-memory/01-decision-register.md` in full — every binding
   decision, the stack section, the non-goals section.
2. Read `/project-memory/00-master-plan.md` and `03-progress.md` if present,
   for what's already built vs. pending.
3. Build the feature list for this GAN loop from decisions that are
   **UI/UX-shaped and not yet built or not yet polished** — this loop is for
   rapid design/prototype iteration, not for re-litigating architecture
   decisions already made. Do not contradict a binding decision; if the
   register's non-goals rule something out, that's off the table here too.
4. If the register's own Provisional Task Plan (`[DERIVED]`, from
   `dev-kickoff-edho-ferdian`'s `references/derived-plan.md`) already covers
   the relevant work item-by-item, use it directly rather than re-deriving.
5. Write the resulting spec labeled `[SOURCED: decision-register]` with a
   pointer back to which decisions/tasks it draws from — every feature in
   the GAN spec should be traceable to a register line, the same
   traceability discipline `spec-mining-edho-ferdian` applies to its own
   output.

## Source B — Mined specs (brownfield, no written spec)

1. Read every file under `/project-memory/mined-specs/` relevant to the
   area being iterated on.
2. Each `### Requirement:` and `### Invariant:` block is a candidate feature
   or constraint for the GAN spec. Preserve their `enforced` location
   references — the Generator phase should know what existing code already
   implements a behavior, so it iterates the UI around it instead of
   reimplementing it from scratch.
3. Do not treat an `<!-- uncertainty: ... -->` marker in a mined spec as
   settled behavior — flag it the same way in the GAN spec, don't resolve it
   by guessing.
4. Write the resulting spec labeled `[SOURCED: mined-specs]` with a pointer
   to which mined-spec file(s)/Requirement IDs it draws from.

## Source C — Exploratory (no spec exists, user wants pure prototyping)

This path exists for real cases — a genuinely new idea with nothing built
yet, no specs to mine. It is **not** a shortcut around Sources A/B when they
happen to be inconvenient to read.

1. Propose a **small** scope: 3-5 features, sized so a single Generate→
   Evaluate loop can meaningfully build and score all of them within the
   iteration cap. This is deliberately smaller than ECC's 12-16 — a large
   invented scope compounds the ground-truth problem instead of just being
   "ambitious."
2. Label the entire spec document, at the top, in bold, unmissably:

   ```
   ## [EXPLORATORY — NOT APPROVED]

   This scope was proposed by gan-harness-edho-ferdian with no backing
   Decision Register or mined spec. It is a starting guess for rapid
   prototyping, not a derived or validated requirement set. Approve, reject,
   or amend before Generate starts.
   ```

3. Still specify concrete design direction (palette, typography, layout
   philosophy) and a project-specific rubric — vagueness doesn't become more
   acceptable just because the scope is exploratory; it just means the
   *feature list itself* isn't a settled fact yet.
4. **Gate**: present this to the user exactly the way
   `dev-kickoff-edho-ferdian`'s Provisional Task Plan is gated — explicit
   approve/reject/amend, and Generate does not start until approval. Never
   let the label quietly disappear from later re-statements of the plan once
   a few iterations have passed; the scope is still exploratory until the
   user explicitly promotes it (e.g., by later running `dev-kickoff-edho-
   ferdian` or `spec-mining-edho-ferdian` for real once the prototype proves
   the idea worth building for real).

## Output format (all three sources)

Write to `gan-harness/spec.md` and `gan-harness/eval-rubric.md` in the
project root (same paths ECC used, so Generate/Evaluate don't need path
changes). Structure of `spec.md`:

```markdown
# Product Specification: [App/feature name]

> Source: [SOURCED: decision-register | SOURCED: mined-specs |
>          EXPLORATORY — NOT APPROVED]
> Traceability: [decision IDs / mined-spec Requirement IDs, or "none —
>                exploratory, pending approval"]

## Vision
[2-3 sentences]

## Design Direction
- Color palette: [specific values]
- Typography: [specific choices]
- Layout philosophy
- Visual identity notes (what keeps this from looking generic)

## Features
[Traced to source above — no invented items. Each feature line references
its source: a decision-register line, a mined-spec Requirement ID, or is
inside the EXPLORATORY block.]

## Evaluation Criteria
[Project-specific notes for the four rubric axes — see
references/evaluate-phase.md for the fixed weights]

## Constraints from source
[Non-goals from the Decision Register, or uncertainties from mined specs,
that Generate must not violate]
```

`eval-rubric.md` carries the four-axis weighted rubric
(design/originality/craft/functionality, see `references/evaluate-phase.md`)
filled in with project-specific detail for what "good" means on **this**
feature set — not a generic restatement of the axis names.
