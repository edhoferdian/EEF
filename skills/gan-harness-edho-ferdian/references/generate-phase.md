# Generate phase — rapid iteration (ported largely as-is from ECC gan-generator)

This phase is the "build it" half of the loop. Unlike
`dev-kickoff-edho-ferdian`'s IMPLEMENT stage, there is no test-first
requirement here and no per-task Reflection block — this is the fast/loose
prototyping variant, by design. Do not import dev-kickoff's heavier
discipline into this phase; if the work turns out to need that discipline,
that's a signal to switch skills, not to slow this one down piecemeal.

## Principles (unchanged from ECC)

1. **Read the spec first** — always start from `gan-harness/spec.md`
   produced by the Plan phase (`references/spec-and-plan.md`). Check its
   `Source:` line — if it says `EXPLORATORY — NOT APPROVED`, confirm the
   user has actually approved it before writing code; if it's still
   unapproved, stop and ask rather than building against a label that says
   not to.
2. **Read feedback before every iteration after the first** — the latest
   `gan-harness/feedback/feedback-NNN.md` from the Evaluate phase.
3. **Address every issue** the Evaluator raised — feedback items are fix
   requirements, not suggestions to consider.
4. **Don't self-evaluate.** Building and judging are separate phases for a
   reason — a generator that scores its own work loses the adversarial
   check that makes this loop useful.
5. **Commit between iterations.** Use git so the Evaluate phase (and the
   user) can see a clean diff per round.
6. **Keep the dev server running** so the Evaluate phase always has a live
   app to drive.

## Workflow

### First iteration
```
1. Read gan-harness/spec.md (confirm it's approved if exploratory)
2. Set up project scaffolding
3. Implement the Must-Have / highest-priority features from the spec
4. Start the dev server (port from spec, or project default)
5. Quick self-check: does it load, do the basic interactions work
6. Commit: "gan-harness iteration-001: initial implementation"
7. Write gan-harness/generator-state.md (see format below)
```

### Subsequent iterations
```
1. Read gan-harness/feedback/feedback-NNN.md (latest)
2. List every issue raised — Critical, Major, Minor
3. Fix in priority order:
   a. Functionality bugs (things that don't work)
   b. Craft issues (polish, responsiveness, states) — see
      references/frontend-craft-checklist.md
   c. Design improvements (visual quality)
   d. Originality (creative differentiation)
4. Restart the dev server if needed
5. Commit: "gan-harness iteration-NNN: address evaluator feedback"
6. Update gan-harness/generator-state.md
```

## Generator state file

Write to `gan-harness/generator-state.md` after each iteration:

```markdown
# Generator State — Iteration NNN

## What Was Built
- [feature/change]

## What Changed This Iteration
- Fixed: [issue from feedback]
- Improved: [aspect that scored low]
- Added: [new feature/polish]

## Known Issues
- [anything you're aware of but didn't fix, and why]

## Dev Server
- URL: [...]
- Status: running
- Command: [...]
```

## Technical guidelines

- Modern framework per the spec's Technical Stack section — don't
  substitute a different stack without saying so.
- Styling: a real system (Tailwind, CSS-in-JS, or the project's existing
  approach) — not global-class plain CSS files.
- Responsive from the start, not bolted on later.
- Handle all states: loading, empty, error, success — see the craft
  checklist for what "handle" actually means for each.
- Clean file structure; extract components/functions before they sprawl —
  same file-size discipline as the rest of this ecosystem (~200-400 lines
  typical, avoid single files doing everything).
- Input validation on anything that takes user input, same as everywhere
  else in this ecosystem — a fast prototype is not an excuse to skip this
  when the feature involves real data entry.

## Avoiding AI-slop — quick reference

The Evaluate phase penalizes these specifically; the full checklist with
more detail and concrete alternatives is
**`references/frontend-craft-checklist.md`**. Quick version while building:

- No generic gradient backgrounds as a default choice.
- No uncustomized default component-library theming (shadcn/Material
  defaults left untouched).
- No stock "Welcome to [App Name]" hero sections.
- No placeholder stock-photo services.
- No identical generic card grids for content that isn't actually uniform.
- Every interactive element needs a real hover/focus state, not just a
  default browser outline or nothing.
- Every async action needs a real loading state, not an instant jump.
- Every list/collection needs a real empty state with actual content, not a
  blank div.
- Every failure path needs a real error state that says what happened, not
  a generic "Something went wrong."

For any of these, don't just avoid the generic version — build the correct
one from `frontend-engineering-edho-ferdian`'s authoring references
(`design-direction.md` for the visual-default items above, `ui-polish.md` +
`composition-and-ux.md` + `accessible-authoring.md` for the interaction-state
items). That skill is the "how to build it right" counterpart to this
checklist's "what to avoid."

## Interaction with the Evaluate phase

The Evaluate phase will drive the live app with whatever automation driver
is available (see `references/evaluate-phase.md`), test the happy path and
edge cases, score against the rubric, and write feedback. When feedback
comes back:

1. Read it completely before touching code.
2. Note every specific issue, not just the ones that seem important at a
   glance.
3. Fix systematically, in the priority order above.
4. Treat any score below 5 on an axis as critical, not a nice-to-have.
5. If a suggestion seems wrong, still try it — the Evaluate phase is
   looking at the live app with fresh eyes; don't dismiss feedback just
   because it doesn't match your own mental model of what you built.
