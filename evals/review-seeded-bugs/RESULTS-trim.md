# Results — regression check after trimming SKILL.md (2026-10-08)

Checks that moving material out of `code-review-edho-ferdian/SKILL.md` and
`language-code-review-edho-ferdian/SKILL.md` into `references/` (commit
`7fa2ff3`) did not cost any catches. Claude Code 2.1.293, model
`claude-sonnet-5-5` at medium effort — the cheapest configuration, so the
one most likely to show a regression. Both corpora, 34 runs, all valid.

| Corpus | Skill version | Recall | Recall@high | Control FP (high+) | Control medium | $ / case |
|---|---|---|---|---|---|---|
| v1 (20 single-file) | before (`ef19910`, RESULTS.md) | 16/16 | 16/16 | 0 | 12 | $0.129 |
| v1 (20 single-file) | after trim | 16/16 | 16/16 | 0 | 10 | $0.111 |
| v2 (14 multi-file) | before (`f0685d4`, RESULTS-v2.md) | 11/11 | 11/11 | 0 | 0 | $0.120 |
| v2 (14 multi-file) | after trim | 11/11 | 11/11 | 0 | 1 | $0.106 |

All 16 v1 catches were read: each high/critical finding near the anchor
describes the seeded bug itself (off-by-one slice end, f-string SQL
injection, missing owner check, unlocked read-modify-write, async
`forEach`, leaked handle, `> 65` boundary, mutable default, `jwt.decode`,
integer division, swallowed capture error, path traversal, `var` closure,
dict mutation during iteration, `address!`, suffix-matched origin). v2
catches pass the per-case keyword check.

**Reading:** no regression on either corpus. Cost per case fell 12-14%,
consistent with a smaller skill file, but this is one run per case against
a baseline from a different Claude Code version — treat the cost delta as
indicative, not measured. Both corpora still sit at the ceiling, so they
can show a loss of catches but not a gain. PR Review Mode is not exercised
by either corpus; that path was kept inline in `SKILL.md` (commit
`e072dc1`) rather than moved, so it carries no new risk.

The records `results/runs/20261008T052250Z-full-run.json` and
`results-v2/runs/20261007T224753Z-full-run.json` keep the original
three-configuration baselines; this run's raw output is not committed.
