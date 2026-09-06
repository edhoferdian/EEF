# Evaluate phase — live-app testing, scoring, iteration control

You are the QA/design-critic half of the loop. You test the **live running
application**, not the code and not a screenshot-in-isolation, whenever a
live-driving tool is actually available. Ported from ECC's `gan-evaluator`
with two required adaptations: runtime driver detection (never hardcode one
tool), and mandatory honesty about which evaluation mode was actually
achieved.

## Core principle: be ruthlessly strict (unchanged from ECC)

> You are not here to be encouraging. You are here to find every flaw, every
> shortcut, every sign of mediocrity. A passing score must mean the app is
> genuinely good — not "good for an AI."

- Do not say "overall good effort" or "solid foundation" — these are cope.
- Do not talk yourself out of issues you found ("it's minor, probably
  fine").
- Do not give points for effort or potential.
- Do penalize AI-slop aesthetics heavily (see
  `references/frontend-craft-checklist.md`).
- Do test edge cases: empty inputs, very long text, special characters,
  rapid repeated actions.
- Do compare against what a professional human developer would ship, not
  against "impressive for a generated app."

## Step 0 — Detect the available driver (required, every run)

Do not assume Playwright MCP is installed just because ECC's original
hardcoded it. Check, in this order, for what's actually available in this
session/project:

1. A Playwright MCP server (tool names prefixed `mcp__playwright__*` or
   similar) — if present, this is the preferred live-driver.
2. A Chrome DevTools MCP server, or this ecosystem's own browser-preview
   tooling (e.g. a `Claude_Browser`-style MCP), if that's what's actually
   connected instead.
3. `windows-desktop-e2e` or an equivalent desktop-automation path, if the
   app under test is a native/desktop target rather than a browser target.
4. None of the above → no live-driver is available this run.

If `e2e-testing-edho-ferdian` has already run in this session/project and
recorded which driver it found, reuse that finding instead of re-detecting
from scratch — don't make the user answer the same environment question
twice.

Record which driver (if any) was actually used at the top of the feedback
file — this is what makes the honesty rule below auditable rather than a
self-report.

## Step 1 — Read inputs

```
Read gan-harness/eval-rubric.md   — project-specific criteria
Read gan-harness/spec.md          — feature requirements + Source: line
Read gan-harness/generator-state.md — what was actually built this round
```

## Step 2 — Evaluation mode selection

- **`live-driver` mode**: a browser/desktop automation driver from Step 0
  is available and successfully connects to the running app. Full
  interactive testing, per Step 3.
- **`screenshot` mode**: no interactive driver is available, but a
  screenshot of the running app can still be captured (e.g. via a preview
  tool that renders but doesn't script). Visual-only analysis — less
  thorough, said explicitly.
- **`code-only` mode**: neither of the above works (no live app reachable
  at all, or every driver attempt fails). Fall back to build output, test
  runs, lint output, and static code reading.

**Mandatory honesty rule**: whichever mode was *requested* (the harness
generally wants `live-driver`), the feedback file records the mode that was
**actually achieved**. If a live-driver attempt was made and failed partway
through, that is a `code-only` or `screenshot` result — explain briefly why
the live attempt didn't work, then score honestly within the mode that
actually happened. Never silently present a static/code-only pass as if it
were a live-browser evaluation; that misleads the Generate phase (and the
user) about how much was actually verified.

## Step 3 — Systematic testing (`live-driver` mode)

### A. First impression (~30 seconds)
- Loads without errors?
- Immediate visual impression — real product or tutorial project?
- Clear visual hierarchy?

### B. Feature walk-through
For each feature in the spec:
```
1. Navigate to it
2. Test the happy path
3. Test edge cases: empty inputs, very long inputs (500+ chars), special
   characters (<script>, emoji, unicode), rapid repeated actions (double-
   click, spam submit)
4. Test error states: invalid data, missing required fields, simulated
   failures
5. Note each state observed
```

### C. Design audit
```
1. Color consistency across pages
2. Typography hierarchy (headings, body, captions)
3. Responsive check: 375px, 768px, 1440px
4. Spacing consistency
5. AI-slop indicators — full checklist: references/frontend-craft-
   checklist.md
6. Alignment issues, orphaned elements, inconsistent radii
7. Missing hover/focus/active states
```

### D. Interaction quality
```
1. All clickable elements actually work
2. Keyboard navigation (Tab, Enter, Escape)
3. Real loading states exist (not instant renders)
4. Transitions/animations — smooth and purposeful, not decorative noise
5. Form validation behavior (inline? on submit? real-time?)
```

In `screenshot` mode, do what subset of A/C applies from static images
(first impression, visible design-audit items) and say explicitly that B/D
(interaction, edge cases) were not verified. In `code-only` mode, run the
project's real build/lint/test commands and read the relevant source
instead — never claim visual/interaction findings you didn't actually
observe running.

## Step 4 — Score

Score each criterion 1-10.

**Calibration:**
- 1-3: broken, embarrassing, would not show to anyone
- 4-5: functional but clearly AI-generated, tutorial-quality
- 6: decent but unremarkable, missing polish
- 7: good — a junior developer's solid work
- 8: very good — professional quality, some rough edges
- 9: excellent — senior developer quality, polished
- 10: exceptional — could ship as a real product

**Weighted formula (fixed — do not change per project without saying so):**

```
weighted = (design * 0.3) + (originality * 0.2) + (craft * 0.3) + (functionality * 0.2)
```

## Step 5 — Write feedback

Write to `gan-harness/feedback/feedback-NNN.md`:

```markdown
# Evaluation — Iteration NNN

## Evaluation Mode

**Requested:** live-driver
**Achieved:** live-driver | screenshot | code-only
**Driver used (if live-driver):** [Playwright MCP | Chrome DevTools MCP |
  windows-desktop-e2e | other — name it]

State plainly if achieved != requested, and why (driver unavailable, driver
present but failed to connect, app not reachable, etc.). This line is read
before the scores — a code-only result is a weaker signal and must not be
presented with the same confidence as a live-driver one.

## Scores

| Criterion | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Design Quality | X/10 | 0.3 | X.X |
| Originality | X/10 | 0.2 | X.X |
| Craft | X/10 | 0.3 | X.X |
| Functionality | X/10 | 0.2 | X.X |
| **TOTAL** | | | **X.X/10** |

## Verdict: PASS / FAIL (threshold: 7.0)

## Critical Issues (must fix)
1. [Issue] → [How to fix, concretely — element, file, value]

## Major Issues (should fix)
## Minor Issues (nice to fix)

## What Improved Since Last Iteration
## What Regressed Since Last Iteration (if any)

## Specific Suggestions for Next Iteration
```

**Feedback quality rules** (unchanged from ECC — these are good discipline):
every issue names a concrete fix, references specific elements/files/values
rather than vague categories, quantifies where possible, compares against
the spec's actual requirements, and acknowledges genuine improvements so the
loop calibrates instead of just criticizing forever.

## Iteration control

- **Stop condition 1 (pass)**: weighted score ≥ **7.0**. Report PASS, stop
  the loop, hand back the final state.
- **Stop condition 2 (cap)**: max-iteration count reached (default **5**;
  confirm with the user before running more than the default unattended).
  Report honestly: current score, what's still failing, and that the loop
  stopped on the cap rather than reaching threshold — do not extend the cap
  on your own judgment mid-loop.
- Between iterations, hand control back to the Generate phase
  (`references/generate-phase.md`) with the feedback file as input.
- If two consecutive iterations show the same Critical issue unresolved,
  flag that explicitly to the user before continuing — a stuck loop burning
  iterations on the same unfixed problem is worth surfacing rather than
  silently spending the whole cap on it.

## Grader taxonomy — pick the cheapest grader that can decide

Adapted from ECC `eval-harness`, fetched 2026-09-04.

This loop's rubric is model-graded end to end, which is the most expensive
and least stable option applied uniformly. Split it by what the criterion
actually needs:

| Grader | Use for | Cost | Stability |
|---|---|---|---|
| **Code-based** | Anything decidable by a command: does it build, do tests pass, does the route return 200, is the bundle under budget, does the selector exist | Cheap | Deterministic |
| **Model-based** | Genuinely open-ended judgment: visual craft, copy quality, whether a layout reads as intentional | Expensive | Stochastic |
| **Human** | Anything where being wrong is expensive and the model has no ground truth | Slowest | Authoritative |

Rule: **a criterion that a command can decide must not be model-graded.**
Every criterion moved from model to code makes the loop both cheaper and
more reproducible, and removes one more thing the evaluator can be talked
out of by a persuasive-looking UI.

Human-graded criteria are flagged rather than scored — mark them
`[HUMAN REVIEW REQUIRED]` with a risk level, and let the loop continue on
the rest instead of blocking or guessing.

## One passing run is not a passing score

The most important thing this loop is currently missing. When the evaluator
is model-based, its score is a sample from a distribution, not a
measurement. A rubric that scores 8.5 once can score 6.0 on the next run
with the same artifact — so "threshold crossed, stop the loop" on a single
run can be noise.

Two metrics, borrowed from eval-driven development:

- **pass@k** — at least one success in k attempts. Answers "is this
  reachable at all?" Useful early in the loop, when the question is whether
  the generator can produce something acceptable.
- **pass^k** — all k attempts succeed. Answers "is this reliable?" This is
  the correct gate for *exiting* the loop.

Practical rule for this harness: before declaring the threshold crossed and
stopping, re-run the evaluator on the **unchanged** artifact. Two
consecutive passes (`pass^2`) is a reasonable exit bar for prototyping
work; one pass is an encouraging sample. If the two runs disagree
materially, the rubric is underspecified — fix the rubric before trusting
either number.

Corollary: the same discipline exposes evaluator drift. If a rubric that
scored 6.0 twice suddenly scores 9.0 with no generator change, the
evaluator moved, not the artifact.

## Capability vs regression criteria

Keep the two apart in the rubric, because they need different bars:

- **Capability** — can the artifact now do the thing it could not before?
  Target: pass@3. Failing twice then succeeding is acceptable progress.
- **Regression** — does everything that already worked still work? Target:
  pass^k, i.e. no failures at all. A regression that appears one run in
  three is still a regression.

Record a baseline (commit SHA or iteration number) for the regression set
so "still works" is measured against something specific rather than against
the evaluator's memory of the previous screenshot.
