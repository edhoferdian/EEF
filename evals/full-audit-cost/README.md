# Full-audit cost check — Mode C

Mode C of `security-review-edho-ferdian` (`references/full-audit.md`)
promises to plan the fewest agents that cover the ledger (ceiling 5) and to
verify every candidate independently. `run.py` measures one real run: it
builds a throwaway git repo from `../review-seeded-bugs/cases-security`
(8 seeded vulnerabilities and 2 safe controls under `src/`), git-ignores
`project-memory/audit/` so the storage guard passes, installs this
checkout's `skills/` and `dist/agents/claude/` as project files, and runs
one headless Claude Code session (`--setting-sources project`, so the
installed skills stay out) that asks for a full audit before production.

```bash
python run.py --dry-run            # build the repo and show the command; no model call
python run.py --label first-run    # one real run; spends model usage
```

Each run writes an append-only record to `results/runs/` with cost, agents
spawned by type, the agent plan from `run-metadata.json`, whether both
vendored validators pass, the verdict counts, and recall against the answer
key: a bug counts when a `confirmed` or `needs_validation` record has a
trace or evidence line in its file within the key's tolerance. The run
directory itself goes to `results/raw/<label>/` (git-ignored).

## Result — 2026-10-29, `first-run`

Record: `results/runs/20261029T132514Z-first-run.json` (parent session at
`sonnet`, effort `medium`).

| | |
|---|---|
| Agents planned / spawned | 2 / 2 — both `security-verifier-edho-ferdian`; no hunters ("small repo hunted inline") |
| Cost (client estimate) | $1.79 — $1.24 Sonnet, $0.55 Opus (the escalated verifier for CRITICAL candidates) |
| Wall time | 8 min |
| Run status | `complete`; both validators pass |
| Verdicts | 8 confirmed, 1 needs validation, 0 rejected |
| Recall | 8/8 seeded vulnerabilities; no `confirmed` record on either control |

The plan matched the design: recon and hunting inline, one standard
verifier for all candidates, one escalated verifier for the CRITICAL ones,
well under the ceiling of 5. The record's `git_dirty` is true because the
checkout had uncommitted domain-reference work at the time; the skills tree
the run used was copied before that work changed anything Mode C reads.

## Limits

One run on a tiny, flat repo of unrelated files. It shows the lower end of
the agent plan and that the pipeline (guard, ledger, verification,
validators, reports) completes end to end. It does not show hunter count or
cost on a real multi-subsystem codebase; measure that on a real project
before quoting a typical cost.
