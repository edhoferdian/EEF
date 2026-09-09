# Output Scorecard (optional REVIEW-stage scoring pass)

Reference for Stage 4 (REVIEW) of `execution-loop.md`. This is an optional,
available scoring pass — not a mandatory replacement for the REVIEW targets
already listed there (acceptance criteria, PDR conformance, abuse cases,
simpler-implementation check, edge cases, secrets). Run it when the task is
non-trivial enough to want a structured second read, when the user asks for a
quality assessment, or when REVIEW's own judgment feels too informal to trust
on its own.

## The 5 axes

Score the task's output — not the implementer's effort or intent — on each
axis, 1–5:

| Axis | What it measures |
|------|-------------------|
| Accuracy | Are the claims correct? Verify against tool output, not memory — grep the codebase, check test results, confirm files exist. |
| Completeness | Are all acceptance criteria covered? List what's there and what's missing, explicitly. |
| Clarity | Is the output well-structured — headings, code blocks, a summary a reader can act on without re-deriving it? |
| Actionability | Can the user act immediately? Is there a diff, a command, a file, a concrete next step — or does it defer work back to them? |
| Conciseness | Is there fluff, hedging, or meta-commentary padding the signal? |

**Hard rule: no score of 5 on any axis without a cited piece of evidence** —
a specific line, a specific tool-output line, or a specific test result. A 5
with no citation is not a 5; score it 4 and say what evidence would close the
gap.

## Report format (plain markdown table — no ASCII bar chart)

```
OUTPUT SCORECARD — TASK [id]

| Axis | Score | Evidence |
|------|-------|----------|
| Accuracy | X/5 | [cited line / tool output / test result] |
| Completeness | X/5 | [what's covered; what's missing, if anything] |
| Clarity | X/5 | [structure signal, or what's unclear] |
| Actionability | X/5 | [the concrete artifact, or what's missing] |
| Conciseness | X/5 | [density note, or what's padding] |

Overall: X.X/5

Self-check: Would the user agree with this assessment? [Yes/No + one line why]

VERDICT: [Ship / Fix N issues then ship / Don't ship — redo]
```

The three VERDICT options map onto this ecosystem's ship/don't-ship framing —
"Ship" means merge as-is, "Fix N issues then ship" names the fixes and their
axes, "Don't ship — redo" means the task returns to PLAN or TEST, not a patch
on top of REVIEW.

## CCL trigger — wired into the loop, not just described here

**A score of ≤2 on any axis is a new Critique-Correction Loop trigger.** This
is recorded in `execution-loop.md`'s Stage 4 CCL auto-trigger list, alongside
the existing HIGH-RISK categories — see that file. When this scorecard runs
and produces a ≤2 on any axis, treat it exactly like a HIGH-RISK auto-trigger:
run the Critic/Corrector round(s) before the task can close, even if the task
itself was not otherwise HIGH-RISK.
