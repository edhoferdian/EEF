# Loop Design & Review

Adapted from ECC `loop-design-check`, fetched 2026-09-04.

The GAN loop in this skill is a feedback wrapper around a feed-forward
system: an LLM has no built-in "steer toward the goal" across turns, so the
loop *is* the goal-seeking behaviour. That means the loop's design carries
the correctness, and its only current safety mechanism is a max-iteration
cap — which bounds the cost of going wrong without reducing the chance.

Run this before starting a loop, and again if one is behaving oddly.

## Gate 0 — should this be a loop at all?

A loop is justified when all three hold:

1. The goal is **machine-decidable** — something can say pass/fail or
   produce a comparable score without a human in the turn.
2. Iteration plausibly improves the artifact. If the second attempt is just
   a re-roll of the first, this is sampling, not a loop.
3. The cost of a wrong iteration is bounded and recoverable.

If any fails, do the work once, deliberately, and review it. A loop around
an undecidable goal burns tokens and produces confident drift.

## The decidable-goal test

Write the exit condition as something a grader could evaluate without
reading the author's mind. "Looks good" is not decidable. "Every rubric
dimension ≥ 8 on two consecutive evaluations, and the build passes" is.

If the goal cannot be written that way, the loop's real exit condition is
"whenever the operator gets bored" — say so out loud instead of pretending
the threshold means something.

## Five ways loops go wrong

| # | Failure | What it looks like | Guard |
|---|---|---|---|
| 1 | **Spinning** | Iterations keep running, score oscillates in a band, nothing converges | Hard iteration cap *and* a no-improvement cap — stop after N iterations with no material gain, not just after N iterations |
| 2 | **Goodhart-gaming the verifier** | The score climbs while the artifact gets worse; the generator learns the rubric's blind spots | Grade some criteria with code, not the model (see `evaluate-phase.md`); change the evaluator's viewing conditions between runs |
| 3 | **Running a wrong answer to completion** | The loop faithfully optimizes something nobody asked for | Re-read the original scope at every Nth iteration — this skill's Plan phase already forbids inventing scope; the loop must not quietly reintroduce it |
| 4 | **Judge dependence** | The evaluator inherits the generator's context and agrees with it | Keep the evaluator's context independent — same rule Stage 4 REVIEW enforces in `dev-kickoff-edho-ferdian` |
| 5 | **Silent boundary crossing** | The loop starts touching files, systems, or data outside its brief | Freeze the write scope (see `safe-execution-edho-ferdian` Gate 3) |

## Red lines — judgment stays with the human

Do not put these inside a loop, no matter how decidable they look:
anything that spends money, sends a message, publishes, deploys to
production, or deletes data. A loop may *prepare* those and stop; a human
takes the last step.

## Reviewing a loop that is already running

Ask, in this order: is the exit condition still decidable · has the score
moved materially in the last three iterations · is the score improving for
the reason it appears to be (spot-check the artifact directly, not the
score) · is anything being written outside the intended scope · would a
person, shown this artifact cold, agree with the current score.

Two or more no's: stop the loop and fix the design. Do not raise the
iteration cap — the cap is not what is failing.
