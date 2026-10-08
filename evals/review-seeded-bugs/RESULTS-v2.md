# Results — seeded-bug benchmark, v2 corpus (2026-10-08)

Claude Code 2.1.292, `code-review-edho-ferdian` as of commit `f0685d4`,
models `claude-opus-5-5` and `claude-sonnet-5-5`, 14 multi-file cases × 3
configurations = 42 runs, all valid. Cost is Claude Code's client-side
estimate at API rates; the runs spent Pro plan usage, not money.

Every v2 case is a small PR: one changed file plus 1-3 existing files, and
a bug that can only be recognised with that context — a spec, a caller, a
test, a config value, another service's consumer. A catch has to name the
right file, sit within 3 lines of the bug, and say something about it
(per-case keywords).

| Config | Recall | Recall@high | Control FP (high+) | Control medium | Findings / case | Cost | $ / case | Wall time |
|---|---|---|---|---|---|---|---|---|
| opus-high (deep today) | 11/11 | 11/11 | 0 | 3 | 4.9 | $3.43 | $0.245 | 5.7 min |
| sonnet-high | 11/11 | 11/11 | 0 | 2 | 4.6 | $1.99 | $0.142 | 6.1 min |
| sonnet-medium | 11/11 | 11/11 | 0 | 0 | 3.8 | $1.68 | $0.120 | 3.8 min |

All 33 catches were read by hand. Each describes the seeded bug and cites
the context file that proves it — "docs/REFUNDS.md says total refunded can
never exceed…", "app.ts:13 mounts exportRouter with only requireAuth",
"config.ts:4, `10, // seconds`", "accounting/consumer.py reads
event["amount_cents"]". The keyword rule rejected no real catch; the
near-but-off-topic findings it set aside were separate issues on nearby
lines.

Control "medium" findings were reasonable, not wrong: Opus and Sonnet high
both noted that the new `reason` field broadcasts free text to every
subscriber, and Opus flagged a cache-staleness risk.

## What this shows

- **Context-dependent bugs did not separate the tiers either.** Given a
  small repository where the relevant context is a short file next to the
  change, Sonnet at medium effort reads it, connects it, and rates the bug
  high or critical as reliably as Opus at high effort.
- **Across both corpora, 27 of 27 seeded bugs were caught by every tier**,
  at high severity, with no high-severity false positive on 7 controls.
- **Cost:** Sonnet medium is 49% of Opus high per case here (46% in v1);
  Sonnet high 58% (74% in v1). Sonnet medium was also the fastest.
- **Noise:** this time Sonnet medium raised the fewest findings and no
  medium findings on controls — the reverse of v1, where Opus was quietest.
  Neither corpus shows a stable noise advantage for either model.

## What it still does not show

Both corpora are small and clean: 1-4 short files, one bug, the relevant
context one hop away and nothing else to read. Real PRs differ in ways
these cases don't cover — many files where the relevant one is buried,
long diffs with several real issues competing for attention, conventions
that live only in other code, and bugs that need two hops of reasoning. If
the deep tier earns its cost, it is there; neither run tested it.

## Recommendation (proposed, not applied)

The evidence now supports a narrower claim than "review needs Opus":

1. **For small PRs, Sonnet is enough.** 27/27 at roughly half the cost.
   The `hemat` profile (deep agents on Sonnet) is a sound choice for users
   whose PRs are mostly small.
2. **Candidate change for D-060 — the user's call:** move
   `code-reviewer-edho-ferdian` from `deep` to `standard`/`high`, and rely on
   the §4.2 escalation rule (re-run one tier up when the PR is wide or the
   review is disputed) for large PRs. Keep `code-critic-edho-ferdian` and
   `security-review-edho-ferdian` at `deep`: the critic must rank at or
   above the reviewer and is the last check on a review, and a missed
   security bug costs the most. Expected saving on the reviewer itself:
   ~40-50%.
3. **Or keep everything at `deep` until a v3 tests scale** — 10-20-file
   PRs with distractors and several issues each. That is the one dimension
   where the deep tier could still be justified, and the only way to know
   without guessing.

Raw per-run output is git-ignored under `results-v2/raw/`; per-case rows,
including near-but-off-topic findings, are in the record
`results-v2/runs/20261007T224753Z-full-run.json`.
