# Seeded-bug benchmark — review agents

Measures how many real bugs the `code-review-edho-ferdian` skill catches at
each model tier, so the tier of the review agents (D-060: code-reviewer,
code-critic and security-review run at `deep`) rests on numbers rather
than on an argument.

The SubagentStop telemetry (`config-hygiene-edho-ferdian` §4.4) can show
escalations and re-runs, but never a bug a reviewer *missed* — a clean
review and a blind one look the same in a log. Only a corpus with known
bugs can measure that.

## Corpus

`cases/` holds 20 small files a PR might add (JS, TS, Python):

- **16 bug cases**, each with exactly one seeded, realistic bug: off-by-one,
  SQL injection, missing ownership check, check-then-act race, async
  `forEach`, leaked file handle, boundary condition, mutable default,
  `jwt.decode` without verification, integer division, swallowed payment
  error, path traversal, `var` closure capture, dict mutation during
  iteration, unsafe non-null assertion, suffix-matched CORS origin.
- **4 clean controls** with no seeded bug, to count false positives.

File names are neutral so nothing hints which files carry a bug. The answer
key (`answer-key.json`) locates each bug by anchor text, not a hand-typed
line number; `run.py` resolves anchors to lines and refuses to run if any
anchor is missing or ambiguous. All cases were written for this benchmark.

## Method

Each run is one headless Claude Code session (`claude -p`) in a fresh temp
directory that holds only the case file:

- `--model` / `--effort` set the configuration under test;
- `--tools Read,Grep,Glob,Skill` — no subagents, so the configured model is
  the only model reviewing (the skill's critique pass runs inline, as on a
  harness without delegation) and no MCP servers;
- `--json-schema` makes the final answer a validated list of findings with
  line and severity, so scoring never parses prose.

Scoring, with a tolerance of ±2 lines around any anchor:

| Metric | Meaning |
|---|---|
| recall | seeded bugs with a finding near them |
| recall@high | the same, counting only high/critical findings — a bug filed as a nit still ships |
| control FP | high/critical findings on clean controls |
| cost | Claude Code's client-side estimate (`total_cost_usd`); on a subscription it is plan usage, not a bill |

## Running it

```bash
python run.py --dry-run                                         # validate, show the plan, no model calls
python run.py --configs sonnet-medium --cases 04-wallet.py --label spot-check   # one run
python run.py --label full-run                                  # everything not yet run
python run.py --score-only --label rescore                      # rescore saved runs
```

Raw output is saved per run under `results/raw/` (git-ignored) and reused,
so an interrupted run resumes. Every scoring pass, including `--score-only`,
writes a new record, `results/runs/<UTC time>-<label>.json`, with the
configs, cases, git commit, claude version and scores; `--label` is
required and an existing record is never overwritten. The records and
`RESULTS*.md` are the committed outcome, and a `RESULTS*.md` cites the
record it reports by file name. Every real run spends model usage — check
the plan with `--dry-run` first.

Records are append-only. A record is the outcome of whatever raw files
were on the machine that scored them, so a partial run or a spot check is
just another record under its own label, never a replacement for a full
run. `python run.py --check-records` (run by the pre-commit hook on staged
changes) and `--check-records <base>` (run by CI against the base of the
push or PR) fail if a committed record is modified or deleted; a
correction is a new record, with the reason in its `RESULTS*.md`.

## Limits

20 cases is a smoke test, not a statistically strong benchmark: a one-case
difference between configurations is noise. Single-file cases with no
surrounding code favour bugs visible locally; cross-file bugs are not
covered. Treat the result as evidence for or against a tier, then confirm
it against the telemetry from real use.
