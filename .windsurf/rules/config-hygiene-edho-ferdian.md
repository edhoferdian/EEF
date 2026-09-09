---
trigger: model_decision
description: "Periodic garbage collection for Edho's own Claude Code environment (`~/.claude`): find redundant, stale, orphaned, or context-expensive items across skills, memory, hooks, permissions, MCP servers, automations and caches, then walk them one by one with a human confirmation and an undo path. Includes the ECC decommissioning track — the concrete checklist for removing the ECC install once its native replacement exists. Use when the user says \"bersihin config\", \"~/.claude berantakan\", \"kebanyakan skill\", \"sesi lambat mulai\", \"audit setup gue\", \"context cepat penuh\", or when a periodic (~30 day) review is due."
---

# Config Hygiene — Edho Ferdian Mode

## Scope — read this first

**Target: the user's own Claude Code environment** — `~/.claude/*`,
project-level `.claude/*`, `~/.claude.json`, and `.mcp.json`.

This is the deliberate complement to `skill-audit-edho-ferdian`, which
audits the *content quality* of this ecosystem's `skills/*` and explicitly
refuses to look at `~/.claude`. This skill looks at exactly what that one
refuses to: the environment those skills run inside.

| Question | Skill |
|---|---|
| Is this ecosystem's skill well-written, non-redundant, links intact? | `skill-audit-edho-ferdian` |
| Should a new skill exist at all, and is it actually obeyed? | `skill-authoring-edho-ferdian` |
| Is the environment carrying dead weight, and what does it cost? | **this skill** |

Never delete autonomously. Every candidate gets its own confirmation.

## Design principles

1. **Append-only configs leak.** Skills, memory files, hooks and permission
   entries only ever get added. Without a periodic pass they rot silently.
2. **Periodic beats one-time.** Scan roughly every 30 days, propose a small
   batch each time. Cap a run at ~20 candidates — this is GC, not a purge.
3. **Per-channel signals.** Each accumulation type has its own staleness
   test. Do not apply one rule everywhere.
4. **Soft-delete first.** Rename to `.disabled` > move to
   `~/.claude/_gc_trash/<date>/` > real deletion. Always keep an undo path.
5. **Human-in-the-loop, per item.** Show the evidence, then `[y/n/skip]`.
   There is no "yes to all".
6. **Log every run** to `~/.claude/gc_log.md`: what was touched, why, and
   how to undo it.

## Scan channels

| # | Channel | Path | Staleness / redundancy signals |
|---|---|---|---|
| 1 | Skills | `~/.claude/skills/*/` | Heavily overlapping names; never triggered in recent transcripts; domain mismatch with actual work; broken or empty SKILL.md |
| 2 | Memory | `~/.claude/**/memory/*.md` + index | Several index entries for one topic; contents contradicted by newer entries; dates already passed; orphans missing from the index; sub-100-word fragments that should merge |
| 3 | Hooks | `~/.claude/hooks/` + settings | Scripts on disk referenced by no hook config; old versions superseded by rewrites |
| 4 | Permissions | `permissions.allow` in `settings.json` / `settings.local.json` | Duplicates; specific entries already covered by a wildcard; one-off grants from past experiments |
| 5 | MCP servers | `~/.claude.json`, project `.mcp.json` | Servers that fail to connect; functional duplicates; long unused |
| 6 | Automations | scheduled jobs / reminders, wherever kept | Fired one-shots older than 30 days; jobs whose target script no longer exists |
| 7 | Project history | `~/.claude/projects/*/` | Stale handoff snapshots; session records superseded by newer state |
| 8 | Runtime caches | `cache/`, `file-history/`, `logs/`, `shell-snapshots/` | Sort by size and mtime; propose items >30 days old and large |
| 9 | Context cost | every loaded component | See §Context budget below — a component can be healthy and still not worth its tokens |

## Config tamper guard (harvested from ECC `plankton-code-quality`)

A distinct failure mode from all nine channels above: an agent facing a
failing lint/format/build gate **loosens the config instead of fixing the
code** — relaxing a `.eslintrc` rule, widening `ruff.toml`'s ignore list,
disabling a `.shellcheckrc`/`.yamllint`/`.hadolint.yaml` check — so the gate
goes green without the underlying issue being fixed. This is metric-gaming,
not cleanup, and it is the same shape of problem the false-positive/gaming
patterns in `gan-harness-edho-ferdian/references/loop-design-review.md`
already name for evaluator loops ("Goodhart-gaming the verifier" — the score
climbs while the artifact gets worse). Treat a lint/format config edit found
during a scan as a high-confidence flag, not a routine change: check whether
it was made *because* a check was failing at the time, and whether it
narrows coverage rather than reflecting a genuinely agreed convention (a
narrowing with an inline comment explaining the deliberate exception is a
documented convention, not tampering — same test `language-code-review-
edho-ferdian`'s Reflection gate already applies to a suppressed lens
finding). This is a detection responsibility for this skill's channel 3/4
scans, not a new channel — a tampered config is the same "stale/unreachable
correctness" concern as any other hook/permission drift, just with a
gaming motive behind it.

## Language/tool gate table (harvested from ECC `plankton-code-quality`)

Useful as a quick cross-check when this skill (or `build-fix-edho-ferdian`
Phase 0) needs to confirm which formatter/linter *should* be running for a
given file extension before treating its absence as a gap:

| Extension / stack | Formatter | Linter | Optional |
|---|---|---|---|
| `.py` | ruff format | ruff | ty, vulture, bandit |
| `.ts`/`.tsx`/`.js`/`.jsx` | biome (or prettier) | biome (or eslint) | oxlint, semgrep, knip |
| `.sh`/`.bash` | shfmt | shellcheck | — |
| `.yml`/`.yaml` | — | yamllint | — |
| `.md` | — | markdownlint-cli2 | — |
| `Dockerfile` | — | hadolint (≥2.12.0) | — |
| `.toml` | taplo | — | — |
| `.json` | jaq | — | — |

Not exhaustive for every stack in this ecosystem (e.g. Go/Rust/Java tooling
lives in those stacks' own build-fix/review references) — this table covers
what ECC's `plankton-code-quality` ships and is meant as a fast reference,
not a replacement for the per-stack detection tables already in
`build-fix-edho-ferdian` and `language-code-review-edho-ferdian`.

## Context budget (channel 9)

Channels 1-8 ask "is this dead?". Channel 9 asks a different and often more
useful question: **"is this alive but not worth what it costs to keep
loaded?"** A perfectly maintained skill that is loaded every session and
fires twice a year is a context-budget problem, not a staleness problem.

Estimate per component — skills (frontmatter always loaded, body on
trigger), MCP server tool definitions (always loaded, frequently the single
largest line item), rules and always-on memory files, hook definitions.
Rank by tokens-per-session against observed usefulness, and report the top
offenders with a concrete recommendation: disable, narrow the description
so it stops loading speculatively, or move to LIBRARY (below).

**DAILY vs LIBRARY.** Borrowed from ECC `agent-sort` (fetched 2026-09-04) —
the classification idea only, never its ECC install-planning machinery.
Split components in two buckets, and require repo evidence for every DAILY
call rather than a feeling:

- **DAILY** — should be available every session for the work actually being
  done. Justified by concrete evidence: file extensions, lockfiles,
  framework configs, CI config, imports.
- **LIBRARY** — worth keeping reachable, not worth loading by default.
  LIBRARY does not mean delete.

## Strategic compaction

Not everything here is deletion. Context also gets reclaimed by compacting
at the right moment. Auto-compaction fires at an arbitrary token threshold,
which usually lands mid-task and discards exactly the working state that
was still needed.

Compact deliberately at a **phase boundary** instead — for work running
under `dev-kickoff-edho-ferdian`, that means after Stage 6 REMEMBER of a
task, once the memory files have been written and the state that matters
is on disk rather than in the window. A session that has just snapshotted
can afford to lose its context; one mid-IMPLEMENT cannot.

## Reference: harness operation

Hook wiring per-type and per-language, model routing tiers, context-budget
mechanics, permission-widening posture, and todo-list-as-steering-surface —
all detail that channels 3 (hooks), 6 (automations), and 9 (context cost)
draw on but that doesn't need to sit inline in this file — lives in
`references/harness-operation.md`.

## ECC decommissioning track

This ecosystem's stated end state (D-005) is to stop depending on the ECC
install entirely. That removal is a config-hygiene operation, and it is the
one place where this skill is allowed to look at ECC-managed paths — to
remove them, never to maintain them.

Run this track only on explicit request. It is ordered so that nothing
breaks before its replacement exists:

1. **Inventory what is actually ECC-managed** — `~/.claude/agents/*`,
   `~/.claude/rules/ecc/*`, ECC-installed skills, ECC hook entries in
   `settings.json`, ECC-specific env vars (`ECC_*`).
2. **Map each one to its native replacement** in this ecosystem's own
   `skills/` (the porting record in `project-memory/02-gap-analysis.md`
   and the decision register are the source of truth for this map).
3. **Report the unreplaced remainder.** Anything ECC-managed with no native
   equivalent is a porting gap, not a deletion candidate — surface it and
   stop. Do not remove a capability that has no replacement.
4. **Disable before deleting.** Rename to `.disabled`, run normally for at
   least one working session, and only then move to `_gc_trash/`.
5. **Check for dangling references** after each removal: grep this
   ecosystem's own `skills/` for pointers into ECC paths. A native skill
   pointing at an ECC file is a D-005 violation and was already found once
   during the kelompok 3 port (`e2e-testing-edho-ferdian`, 4 locations).

## Workflow

1. **Scan** the channels the user named, or all of them. Collect: path,
   channel, the signal that flagged it, size, last-modified.
2. **Rank by confidence** — broken/orphaned is high, merely old is low —
   and present a numbered table. Cap at ~20.
3. **Confirm one by one.** Show the evidence, then `[y/n/skip]`. The user
   can stop at any point.
4. **Soft-delete** what was confirmed. Permission entries live in JSON with
   no comments: back up the settings file, record each removed entry
   verbatim in `gc_log.md`, then remove it from the `allow` array.
5. **Log** the run.
6. **Report**: what was reclaimed, which channels are healthy, suggested
   next review date.

## Rules

- Never delete autonomously, and never offer a "yes to all".
- An item that is merely old is a low-confidence candidate. Broken,
  orphaned, or unreachable is high-confidence. Do not present them at the
  same severity.
- Do not touch project source code. That is refactoring — see
  `dead-code-cleanup-edho-ferdian`.
- Do not touch this ecosystem's `skills/` content quality; that is
  `skill-audit-edho-ferdian`'s job. Channel 1 here only asks whether a
  skill is *installed and loaded*, never whether it is *well written*.
- ECC-managed paths are in scope only inside the decommissioning track,
  and only ever to remove them.

## Provenance

Adapted from ECC `config-gc`, `context-budget`, `workspace-surface-audit`,
`automation-audit-ops`, `strategic-compact`, and the DAILY/LIBRARY concept
of `agent-sort` — all fetched 2026-09-04. Consolidated into one skill with
per-channel lenses per D-009 rather than six near-overlapping skills.
The ECC decommissioning track has no upstream equivalent; it exists
because of D-005 and inverts `agent-sort`'s purpose (which was to plan an

> **Truncated for Windsurf's 12,000-character workspace rule limit.** Read the full skill at `skills/config-hygiene-edho-ferdian/SKILL.md` for complete instructions.
