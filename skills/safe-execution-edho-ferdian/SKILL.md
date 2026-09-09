---
name: safe-execution-edho-ferdian
description: >-
  Mechanical gates around agent execution, as a complement to this
  ecosystem's reasoning gates: a pre-action fact-forcing gate that demands
  concrete investigation before the first edit to a file, a destructive-
  command guard, a write-scope freeze for autonomous or parallel agent
  runs, and a stop-gate that blocks "done" until the memory files were
  actually touched. Use when running agents autonomously or in parallel,
  when working against production, or when the user says "jangan sampai
  kehapus", "agent-nya nulis di luar scope", "pastiin dia ngecek dulu".
---

# Safe Execution — Edho Ferdian Mode

## Why this exists: reasoning gates cannot catch this class

This ecosystem is already dense with **reasoning gates** — the 8-gate
Reflection block, the Critique-Correction Loop, EDHO SCAN, the Output
Scorecard. Every one of them asks the model about its own work, after the
work is done.

That has a known ceiling. Asking a model "did you violate anything?"
reliably returns "no" — self-evaluation shares the biases that produced the
output. What changes behaviour is being made to **produce a fact**: asked
to list every file that imports a module, the model has to actually run
Grep and Read, and the resulting context changes what it writes next.
Internal A/B measurements on gated vs ungated agents put the gap at
roughly +2.25 points on a 10-point rubric across two tasks — a small
sample, quoted as directional evidence rather than proof.

So the gates here are deliberately **not** reasoning gates. Each one either
demands an artifact or checks a machine-verifiable fact.

## Gate 1 — Fact-forcing, before the first touch of a file

Three stages, in order. Stopping at DENY is what most guards do and it is
the least useful part:

```
DENY  — block the first Edit/Write/Bash attempt against a target
FORCE — state exactly which facts must be produced
ALLOW — permit the retry once those facts are on the table
```

**Before editing an existing file**, produce:
1. Every file that imports or requires it (search the tree — Grep/Glob).
2. The public functions or classes this change affects.
3. If it reads or writes data files: the field names, structure, and date
   format — using redacted or synthetic values, never raw production data.
4. The user's current instruction, quoted verbatim.

**Before creating a new file**, produce:
1. The file(s) and line(s) that will call it.
2. Confirmation that no existing file already serves that purpose.
3. Data-shape facts, as above, if it touches data files.
4. The user's current instruction, quoted verbatim.

Fact 3 is the one people skip and the one that pays. In both A/B trials
the ungated agent assumed ISO-8601 dates while the real data used
`%Y/%m/%d %H:%M`. Checking the actual shape kills that entire bug class.

Fact 4 looks like ceremony and is not: re-reading the literal instruction
before acting is the cheapest defence against the drift where an agent, six
tool calls deep, is solving an adjacent problem it invented.

Scope: **first touch per target, not every edit.** Once the facts are
presented, further edits to that same file proceed freely. A gate that
fires on every call gets disabled by lunchtime.

## Gate 2 — Destructive commands, every single time

Unlike Gate 1, this one never gets a free pass after the first hit.

Watched: `rm -rf` (especially against `/`, `~`, or a project root),
`git reset --hard`, `git push --force`, `git checkout .`, `git clean -fd`,
`DROP TABLE` / `DROP DATABASE`, `docker system prune`, `kubectl delete`,
`chmod 777`, `sudo rm`, `npm publish`, and anything carrying `--no-verify`.

On a hit, produce before running:
1. Every file or dataset the command will modify or delete.
2. A one-line rollback procedure.
3. The user's current instruction, quoted verbatim.

If step 2 cannot be written, that is the answer: do not run it.

`--no-verify` is on the list deliberately — it is the mechanical form of
"skip the checks", and it is exactly what an agent under time pressure
reaches for.

Never build a shell command by interpolating a string. Pass the executable
and its arguments as separate entries with `shell: false` — string
interpolation is how a filename with a space or a quote becomes an
arbitrary command.

## Gate 3 — Freeze: scope the write surface

Freeze Mode locks Write/Edit to a named
subtree; reads stay unrestricted. Anything outside is refused with an
explanation rather than silently allowed.

This is the directly load-bearing gate for how this ecosystem actually
works. Its own porting effort dispatches several Sonnet agents in parallel,
each owning a slice of the tree — and the kelompok 3 batch found real
damage of exactly this shape afterwards (an agent leaving stale pointers
into out-of-scope paths across files outside its brief, fixed by hand
later). A freeze on
each agent's assigned subtree turns that from a post-hoc discovery into a
refusal at the moment it happens.

Use it whenever: an agent runs unattended, several agents run in parallel,
or the work touches production or a migration.

**Single writer, even across models.** When more than one model or process
contributes to one change, only one of them may write to the filesystem —
the rest produce a proposal (a diff, a patch, a plan) for the writer to
apply, never a direct write of their own. Two writers on the same change
means there is no single diff left to review and no way to attribute a
regression to the process that caused it.

## Gate 4 — Stop-gate: do not declare done before the record is written

Retargeted from a learning-library path convention to this ecosystem's
`project-memory/`.

Stage 6 REMEMBER of `dev-kickoff-edho-ferdian` requires the memory files to
be updated "in the same turn, not later", and the anti-pattern table
already names **Snapshot debt (>3 tasks with no fresh snapshot)** — an
anticipated failure with no enforcer. This is the enforcer, and it uses
only deterministic checks: mtimes and counters, no inference.

| Check | Mechanism | On hit |
|---|---|---|
| Task was substantial | count of Edit/Write calls this session ≥ 3 | classifies the session as complex; below that, nothing else runs |
| Memory files untouched | mtime of `project-memory/03-progress.md`, `01-decision-register.md`, `04-instincts.md` older than this session's start | **Block** when the session is complex and none were touched |
| Rationalization language | regex over the transcript tail | **Warning only**, never a block |

The rationalization patterns worth watching are the exact phrases that
precede a Gate 2 or regression-rule violation: *"skip tests for now"*,
*"pre-existing bug"*, *"this was already broken"*, *"good enough for now"*.
They warn and never block, because a regex on prose false-positives and a
gate that blocks on a false positive gets turned off.

Note the honest limitation: this enforces the **habit** of writing the
record, not the **quality** of what was written. That is what the Reflection
block and the audit skills are for. Defense in depth, not a replacement.

Report execution state with exactly one of: `inspected` / `changed locally` /
`verified locally` / `committed` / `pushed` / `blocked`. Never say *fixed*
until the proving command has been rerun and named. Never say *pushed*
unless the upstream branch actually moved.

## Choosing gates

| Situation | Gates |
|---|---|
| Ordinary interactive work | 4 only |
| Unfamiliar or high-fan-in codebase | 1 + 2 + 4 |
| Parallel agents, each owning a subtree | 1 + 2 + 3 (per agent) + 4 |
| Production, migrations, deploys | 2 + 3, always |

## Rules

- Never substitute self-evaluation for a gate. "Are you sure?" always
  returns yes; that is measured, not assumed.
- Do not gate every Bash call. Routine commands gate once per session,
  destructive ones every time. Getting this balance wrong is how gates get
  switched off, and a disabled gate protects nothing.
- Do not pre-answer a gate's questions from memory to satisfy it. The
  investigation is the mechanism; a recited answer is theatre.
- A gate that cannot persist its state should fail **open** — allow the
  action and warn — rather than loop.
- These gates never replace REVIEW or VERIFY. They are pre-action and
  post-session bookends around a loop that still has to run.

## Appendix — implementing these as hooks (Claude Code)

Portable practice first: every gate above is written so a human or an agent
can run it by hand in any harness (D-008). This appendix is the optional
mechanical binding for Claude Code specifically — `PreToolUse` for gates
1-3, `Stop` for gate 4 — including hookify rule-file syntax
(`.claude/hookify.<rule-name>.local.md`) for the pattern-matching gates.
Nothing above depends on this appendix existing.

## Growth path

This skill is intentionally single-file — four gates read fine as one
document because they share one voice (mechanical, fact-forcing) rather than
four distinct lenses. If a fifth gate is added, or any single gate above
grows enough to need its own worked examples/edge-case catalogue (the way
`click-path-audit-edho-ferdian` split framework-specific tracing detail out),
split that gate into `references/`, following the domain+lens pattern other
skills in this ecosystem use — do not let this file creep past ~300 lines to
avoid making that call.
