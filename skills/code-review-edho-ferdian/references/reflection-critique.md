# Reflection & Critique-Correction Protocols

Detailed reference for Phase 3 (Reflection / Refleksi Diri) and Phase 4
(Critique-Correction Loop / Dua Agen Saling Mengoreksi). These two passes exist
to attack the single biggest weakness of AI code review: **confident false
positives, inflated severity, and fixes that quietly change behavior.** A review
that survives both passes is one a maintainer can trust without redoing it.

---

## Pre-Report Gate — runs BEFORE a finding is written, not after

This gate is distinct
from Phase 3 below: Phase 3 audits a *draft that already exists*; this gate
decides **whether a finding gets drafted at all**, during Phase 1 as you work
through the checklist. Apply it the instant you notice something that looks
like an issue, before it becomes a line in the report — this stops noise from
ever entering the draft rather than cleaning it up afterward.

Before writing any finding tagged 🟠 HIGH or 🔴 CRITICAL, answer all four
questions. If any answer is "no" or "unsure," **demote the severity or drop
the finding** — don't draft it at HIGH/CRITICAL and hope Phase 3 catches it.

1. **Can I cite the exact line?** Name the file and line/function. "Somewhere
   in the auth layer" is not actionable and must be dropped, not softened.
2. **Can I name the concrete failure scenario?** State the specific input,
   state, and bad outcome. If you can't name the trigger, you're
   pattern-matching against "code that looks like X usually has problem Y,"
   not reviewing this code.
3. **Have I read the callers and existing tests?** Check callers, imports,
   and tests before flagging. Many apparent issues are already handled one
   frame up, guarded by a type, or exercised by a test that proves the
   worried-about case is fine.
4. **Is the severity defensible?** A missing docstring is never HIGH. A
   single `any` in a test fixture is never CRITICAL. Severity inflation
   erodes trust in the report faster than an occasional missed finding does.

For any finding that survives at HIGH or CRITICAL, it must carry all three of:
the exact snippet + line number, the specific failure scenario (input, state,
outcome), and why existing guards (types, validation, framework defaults)
don't already catch it. If you can't produce all three, demote to MEDIUM or
drop it.

**A clean pass is a valid outcome.** Returning zero HIGH/CRITICAL findings on
a small, well-typed, tested diff that follows the project's own patterns is
correct — do not manufacture findings to look thorough. See
`references/false-positive-catalogue.md` for the ~12 concrete patterns LLM
reviewers commonly over-flag; check any candidate finding against that list
before drafting it.

---

## Phase 3 — Reflection (Refleksi Diri)

A structured self-audit of your own draft findings and fixes, run **before** the
user sees anything. Single-agent. Go finding by finding; be willing to delete
your own work.

### The six reflection gates

For **each finding**, pass it through these gates in order:

1. **Evidence gate.** Can I cite an exact location (line range, function,
   variable) and the specific token/pattern that proves the issue? If I'm
   pattern-matching to "code that looks like X usually has problem Y" without a
   concrete locus → **drop it**, or demote to ⚪ Info phrased as a question.

2. **False-positive gate.** Could this be correct or intentional in context I
   can't see? Examples: a "hardcoded value" that is a legitimate documented
   default; a "missing await" on a deliberately fire-and-forget call; a "magic
   number" that's a well-known constant. If a benign reading is plausible →
   **downgrade and state the assumption** ("flagged assuming X; if Y, ignore").
   Cross-check every candidate finding against
   **`references/false-positive-catalogue.md`** — it catalogues ~12 concrete
   patterns LLM reviewers commonly over-flag; a match there is a strong signal
   to drop or downgrade.

3. **Severity-calibration gate.** Is severity = real impact × exploitability/
   likelihood, or am I inflating to look thorough? A theoretical XSS on an
   admin-only, authenticated, internal field is not 🔴. Recalibrate honestly.
   Under-calling a real auth bypass is just as wrong as over-calling a style nit.

4. **Overlap gate.** Am I reporting one root cause as several findings (e.g.
   "no input validation" surfacing as five separate entries)? **Merge** into one
   finding with multiple locations.

5. **Intent-preservation gate.** Does my proposed fix change *observable
   behavior* (outputs, side effects, API contract, ordering)? Code review fixes
   implementation, not behavior, unless the user asked for a behavior change. If
   the fix would alter behavior → **revise the fix** to be behavior-preserving,
   or reclassify it as a "proposed behavior change — needs sign-off."

6. **Hallucination gate.** Am I asserting how a library/framework/API behaves,
   or that a function exists, without having verified it? → label
   **[needs verification]**, or actually verify it in Phase 2. Never state
   version-specific or time-sensitive behavior as settled fact.

### Output of Phase 3

A concise, auditable **Reflection Notes** block for the final report:

```
Reflection Notes
- Dropped CQ-xx (no concrete location — was a generic pattern guess).
- Downgraded SEC-yy 🔴→🟡 (exploit requires admin auth; impact limited).
- Merged PERF-aa + PERF-bb (same root cause: unbatched DB calls).
- Held PERF-cc at [Low — needs verification] (depends on prod data volume).
```

This block is not optional. It is the visible proof that the review was
self-corrected, and it tells the maintainer exactly where your confidence is thin.

### Why this works (don't skip it)

Self-critique reliably removes a meaningful share of spurious findings in review
tasks, because generation and verification are different cognitive modes — asking
"is this actually true?" surfaces errors that "find the problems" does not. The
cost is a few hundred tokens; the payoff is a report that doesn't cry wolf.

---

## Phase 4 — Critique-Correction Loop (Dua Agen)

An **adversarial** pass. Reflection is you checking yourself; this is a second
role trying to *break* your work. The independence is the value — a critic whose
job is to disagree finds things a self-review rationalizes away.

A single agent reviewing
its own output shares the biases, knowledge gaps, and systematic errors that
produced it; two reviewers with no shared context break that failure mode.
This is the written justification for why Stage 4 requires a reviewer who did
not reuse the implementer's reasoning, and why Critic and Corrector stay
separated in CCL.

### Roles

- **Reviewer (Agent A)** — owns the findings + fixes produced in Phases 1–3.
- **Critic (Agent B)** — owns the attack. B's mandate, in B's own words:
  > "Treat every finding as guilty until proven real. For each one, demand the
  > evidence; if A can't point to the exact code, it's a false positive — strike
  > it. For each fix: will it compile/run? Does it preserve behavior? Is it the
  > simplest correct fix, or over-engineered? Then hunt for what A **missed** —
  > especially security and performance issues that don't look like bugs. Finally,
  > re-check the report's claims against the actual code; flag any drift between
  > what the report says and what the code does."
- **Correction** — A responds to each of B's points: **accept** (revise the
  finding/fix) or **reject** (with a concrete reason). A then emits the revised
  set.

### Termination & guardrails (this part is mandatory)

Correction loops fail in two ways: they **oscillate** (A and B flip-flop) or they
**over-correct** (each round adds caveats until the output is mush). Bound it:

- **Max 2 rounds.** Hard cap.
- **Converge early.** If a round produces no material objection, stop — don't
  manufacture disagreement to fill the quota.
- **Materiality filter.** Only **correctness, security, and behavior** disputes
  justify a second round. Style/taste disagreements are logged, not looped on.
- **Disagreement is allowed to stand.** If A and B can't resolve a genuine
  technical dispute, **surface both positions to the user** with the tradeoff —
  don't force a fake resolution or average them into something neither believes.

### Implementation: real subagents vs role-play

- **With subagents (Claude Code `Task` tool):** spawn A and B as *separate*
  agents so B doesn't inherit A's rationalizations. This is the stronger setup.
  Give B only the code + A's report, and the critic mandate above. Cost: extra
  tokens/latency for genuine independence — usually worth it for pre-merge or
  security-sensitive reviews.
- **Without subagents:** role-play the two parts sequentially in one context.
  Less independent (you've seen A's reasoning), but still catches real errors if
  you commit to the adversarial stance. State which mode you used in the report.

### Output of Phase 4

One line in the report:

```
Critique-Correction: converged in 2 rounds via subagents.
  B struck CQ-zz (false positive), forced SEC-yy fix to preserve return type,
  added PERF-dd (missed N+1 in pagination). 1 unresolved dispute surfaced below.
```

…followed by any unresolved disputes, each as: the question, A's position,
B's position, and the tradeoff for the user to decide.

---

## How the two passes relate

Reflection (Phase 3) is cheap and always runs — it cleans up obvious
self-deception. Critique-Correction (Phase 4) is heavier and earns its cost on
**high-stakes reviews**: pre-merge to main/prod, security-sensitive code, or when
the user explicitly wants maximum rigor. For a quick sanity check on a throwaway
script, Phase 3 alone may suffice — say so and let the user opt into Phase 4
rather than burning tokens by default on low-stakes code.

---

## Ambiguous decisions — when to convene instead of critique

CCL attacks a finished
output; this is for a different moment — a genuinely ambiguous go/no-go
decision during Stage 3, before there is an output to critique yet (the
same moment that already triggers "STOP — this is a binding decision, ask
the user" in `execution-loop.md`).

Convene 3-4 distinct voices rather than one continued train of thought:
the in-context reasoning so far, a dedicated Skeptic voice arguing the
opposite case, and 1-2 domain lenses relevant to the decision (e.g. a
PM-style "does this serve the actual goal" voice and a QA-style "what
breaks" voice — the same two-persona split used elsewhere, without
needing a full persona roster).

Synthesize by naming the disagreement explicitly rather than forcing
convergence — if the voices genuinely disagree, that disagreement is the
finding to bring to the user, not something to average away. Cap at 2
rounds, same as CCL.

**Optional external cross-check:** if a second, differently-trained model is available
and the decision is high-stakes enough to warrant it, one voice above may be
an external model's critique instead of another in-context persona — a
model with different training is a stronger adversary than a same-model
persona split, because it doesn't share this session's blind spots. This is
opt-in only: never send code or decision context to an external model
without the user's explicit consent for that specific case (this is a
distinct action from D-011-style local file work, and the user's
own data-handling boundaries apply).
