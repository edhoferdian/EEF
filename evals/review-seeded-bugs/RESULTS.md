# Results — seeded-bug benchmark, run 1 (2026-10-07/08)

Claude Code 2.1.292, `code-review-edho-ferdian` as of commit `ef19910`,
models `claude-opus-5-5` and `claude-sonnet-5-5`, 20 cases × 3
configurations = 60 runs, all valid. Cost is Claude Code's client-side
estimate at API rates (the runs were on a Pro subscription, so they spent
plan usage, not money).

| Config | Recall | Recall@high | Control FP (high+) | Control medium | Findings / file | Cost | $ / case | Wall time |
|---|---|---|---|---|---|---|---|---|
| opus-high (deep today) | 16/16 | 16/16 | 0 | 9 | 7.4 | $5.63 | $0.281 | 12.5 min |
| sonnet-high | 16/16 | 16/16 | 0 | 10 | 9.6 | $4.18 | $0.209 | 15.2 min |
| sonnet-medium | 16/16 | 16/16 | 0 | 12 | 9.2 | $2.57 | $0.129 | 8.5 min |

Every "caught" was checked by hand, not only by line distance: in all 48
bug-case runs the matched high/critical finding describes the seeded bug
itself (e.g. "jwt.decode() does not verify the signature", "forEach does
not await"). The ±2-line rule did not inflate the score.

## What this shows

- **Ceiling effect — the corpus does not separate the tiers.** All three
  configurations caught every seeded bug at high or critical severity and
  raised no high-severity false positive. Bugs that are visible inside one
  short file are within Sonnet-medium's reach.
- **Cost differs a lot for the same catch rate.** Sonnet medium costs 46%
  of Opus high per case; Sonnet high 74%. For single-file, locally visible
  bugs, Opus buys nothing measurable here.
- **Opus is the quietest reviewer.** It raised the fewest findings per file
  (7.4 vs 9.2–9.6) and the fewest medium findings on clean controls (9 vs
  10–12) — less noise to wade through, but this corpus cannot say whether
  that matters to the outcome.
- **Sonnet high was slower than Sonnet medium and Opus** with no gain in
  catches: higher effort spent more turns, not better results, on this set.

## What it does not show

The deep tier was chosen for *quiet* mistakes — bugs that only appear with
context the file doesn't hold: a spec in another file, a caller that
breaks an invariant, a cross-module race, a security assumption made three
files away. This corpus has none of those; every bug is visible within a
few lines. So the result neither confirms nor refutes the deep tier for
real PR reviews. A one-case difference would have been noise anyway at
n=16.

## Recommendation (proposed, not applied)

1. **Keep code-reviewer, code-critic and security-review at `deep` for
   now.** This run is not evidence against them — it measured a different
   kind of bug than the one that justified the tier.
2. **The `hemat` profile is defensible for small, single-file reviews:**
   on locally visible bugs, Sonnet matched Opus at roughly half the cost.
3. **Build a v2 corpus that can separate the tiers before changing any
   tier:** multi-file PR diffs where the bug needs context from another
   file, a spec or test contradicting the code elsewhere, distractor
   files, and subtler concurrency and authorization bugs. Add per-case
   keywords to the answer key so a "catch" is checked for meaning
   automatically, not only by line distance.

Raw per-run output is git-ignored under `results/raw/`; per-case rows are
in the record `results/runs/20261008T052250Z-full-run.json`.
