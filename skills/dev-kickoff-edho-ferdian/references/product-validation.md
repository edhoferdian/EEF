# Product Validation — Should This Be Built At All?

Adapted from ECC `skills/product-lens`, fetched 2026-09-06. ECC's Mode 2
(founder review / PMF scoring) and Mode 3 (user-journey audit) are dropped:
Mode 2 assumes a company with growth and revenue signals, and Mode 3
duplicates `e2e-testing-edho-ferdian/references/qa-sweep.md`.

This runs **before** Phase 1 planning, not inside it. `dev-kickoff` answers
"how do we build this correctly"; `system-design-edho-ferdian` answers "what
shape should it have". Neither asks whether the thing should exist. That
question is cheap to ask and expensive to skip.

## When this gate applies

Run it when:
- a new project or a substantial new feature is proposed with no written
  justification
- the user is choosing between several things to build next
- the request arrived as a solution ("add a plugin system") rather than as a
  problem

Skip it when the work is a bug fix, an explicitly requested change, a
maintenance task, or a feature whose justification is already written in the
Decision Register.

**Time budget: 10 minutes.** If it takes longer, the answer is probably "not
yet" and the extra time is rationalization.

## Mode 1 — The seven questions

Answer all seven in writing. An unanswerable question is itself the finding.

1. **Who is this for?** A specific person in a specific situation. "Users"
   and "developers" are non-answers.
2. **What is the pain?** Quantified: how often does it happen, how bad is it
   each time, and **what do they do today instead?** The current workaround
   is the real competitor.
3. **Why now?** What changed — a new capability, a new constraint, a
   repeated complaint — that makes this the right moment rather than a
   generic good idea?
4. **What is the 10-star version?** If effort were free. This exposes what
   the feature is *actually* reaching for.
5. **What is the smallest version that proves the thesis?** Not the smallest
   shippable thing — the smallest thing that tells you whether the belief in
   question 2 is true.
6. **What is the anti-goal?** What this explicitly does not do. A feature
   with no stated non-goals will grow until it is unfinishable.
7. **How will we know it worked?** One observable signal, defined before
   building. "It feels better" is not a signal.

### Output

```text
PRODUCT BRIEF — <name>
Date: <YYYY-MM-DD>

For:            <specific person / situation>
Pain:           <frequency × severity>  |  Today they: <current workaround>
Why now:        <the change that opened this>
10-star:        <the unconstrained version>
Smallest proof: <what actually tests the thesis>
Anti-goals:     <what this will not do>
Success signal: <one observable, defined now>

RISKS
- <the assumption that, if wrong, makes this worthless>

VERDICT: build now | build smaller | not yet (revisit when <trigger>) | no
```

**A `not yet` verdict must name its trigger.** "Not yet" without a trigger
is a silent no, and silent nos come back as the same proposal in three
months.

## Mode 2 — Choosing between candidates

When there are more ideas than capacity:

1. List every candidate at the same granularity — a mix of "add dark mode"
   and "rewrite the storage layer" produces a meaningless ranking.
2. Score each: **impact (1-5) × confidence (1-5) ÷ effort (1-5)**.
   - *Impact*: how much the success signal from Mode 1 moves.
   - *Confidence*: how sure you are impact is real — this is where honesty
     lives. An untested assumption caps confidence at 2.
   - *Effort*: including test, docs, and the maintenance tail, not just the
     first implementation.
3. Rank by score, then **apply hard constraints**: available time,
   dependencies, and anything already half-built (finishing usually beats
   starting).
4. Output a short ordered list with one line of rationale each, and name
   what is deliberately *not* being done.

Scores are a conversation starter, not an oracle. If the ranking contradicts
strong intuition, the intuition is usually encoding a constraint that is
missing from the effort estimate — find it and write it down rather than
overriding the score silently.

## Hand-off

- `build now` / `build smaller` → the brief's anti-goals and success signal
  become entries in the Decision Register (`intake-validation.md`), then
  Phase 1 planning proceeds normally.
- `not yet` → record the verdict and its trigger in the register too. A
  documented "not yet" is a real decision and prevents re-litigating it.
- The brief is a `[USER]`/`[INFERENCE]`-labeled artifact, not evidence. If
  question 2 or 3 needs outside facts, that is a
  `research-ops-edho-ferdian` pass, not a guess dressed as a brief.
