# Agent Roster & Harness Integration

Reference for Phase 2 of dev-kickoff-edho-ferdian v2.0.

Goal: give the project a small set of **scoped agents** that map onto the
six-stage loop, written in the layout the detected harness actually reads —
without duplicating a harness the user has already installed.

---

## Step 1 — Detect the harness BEFORE writing anything

Check the repo and the user's environment for:

| Signal | Means |
|--------|-------|
| `.claude/agents/`, `~/.claude/agents/`, `CLAUDE.md` | Claude Code |
| `.claude-plugin/`, a project-installed agent-harness plugin, `RULES.md` + `skills/` at root | An agent harness installed **for this project** |
| `.cursor/rules/`, `.cursorrules`, `.cursor/agents/` | Cursor |
| `AGENTS.md`, `.codex/` | Codex / OpenCode / generic |
| `.github/copilot-instructions.md`, `.github/prompts/` | Copilot |
| none of the above | pure chat → emit paste-ready blocks |

These are all **repo-local, file-based** signals — they answer "has this
project adopted a harness," not "is one available at all." That distinction
matters because an agent harness is commonly installed **globally** (as a
Claude Code plugin, in `~/.claude/`) rather than per-project, and a fresh
repo with none of the files above can still have one available one command
away.

**Second signal — session-level availability, not repo files.** Separately
from the table above, check whether such a harness is loaded in *this*
session: its own skills, commands, or roster agents (the per-language
`*-reviewer` / `*-build-resolver` set) showing up in what's available to you
right now. This tells you a harness is *installed on the machine*, not that
it's wired into the project you're kicking off — treat the two signals
independently:

| Repo-file signal | Session signal | Read it as |
|---|---|---|
| present | present | The harness owns this project already — defer, don't ask |
| absent | present | A harness is available but not yet adopted here — **ask the user** whether to wire this project into it (Step 5) before deciding whether this skill supplies its own roster; don't assume either way |
| present | absent | Unusual (project has harness files, but this session can't see it loaded) — note the discrepancy, trust the repo files, proceed as if installed |
| absent | absent | No harness anywhere — this skill supplies the roster (Step 2) |

**Rule: an installed harness wins.** If a comparable system is
present, do **not** write a competing planner/reviewer/TDD instruction set.
Two systems giving the agent different definitions of "review" is worse than
having one. Instead:

- Write the **project-specific** layer only: the Decision Register, non-goals,
  domain rules, conventions, stack versions, and the current task pointer.
- Map this skill's stages onto the harness's own surfaces and say so
  explicitly in CLAUDE.md, e.g. plan → the harness's planning workflow, test →
  its TDD workflow, review → its fresh-context review agent, verify → its
  quality gate. Verify those surfaces exist before referencing them; do not
  cite commands from memory.
- Record the mapping as a decision in `01-decision-register.md` so a future
  session doesn't re-litigate it.

If no harness is installed, this skill supplies the roster itself (Step 2).

## Step 2 — The roster (only when no harness owns these roles)

Six core agents, one per stage, plus optional stack reviewers. Keep each
definition short — a long agent file is a context tax paid on every
invocation.

| Agent | Stage | Scope | Must NOT |
|-------|-------|-------|----------|
| `planner` | PLAN | Read specs + memory, produce a task plan with acceptance criteria and file list | Write code |
| `test-author` | TEST | Write failing tests from acceptance criteria | Change implementation to make tests pass |
| `implementer` | IMPLEMENT | Make the failing test pass, follow PDR §3 | Modify or weaken the test |
| `reviewer` | REVIEW | Fresh-context critique: correctness, security, spec conformance | See the implementer's reasoning |
| `verifier` | VERIFY | Run build/lint/types/tests, report raw tool output | Fix anything it finds — it reports |
| `memory-keeper` | REMEMBER | Update project-memory, write the snapshot, propose instincts | Invent progress not backed by tool output |

Add stack-specific reviewers **only when the stack warrants it** (a database
reviewer for heavy schema work, a security reviewer when the project handles
payments or personal data). Every extra agent is a maintenance cost; a roster
nobody invokes is dead weight.

**The separation that does the work:** `reviewer` must not inherit the
implementer's context, and `verifier` must not be allowed to fix what it
finds. Those two boundaries are where most of the value comes from — a
reviewer that already believes the code is correct reviews nothing.

## Step 3 — Write the roster into the right layout

| Target | Path | Format |
|--------|------|--------|
| Claude Code | `.claude/agents/<name>.md` | frontmatter `name`, `description`, `tools` + body |
| Cursor | `.cursor/agents/<name>.md` (build-dependent) | keep short; Cursor loading behavior varies |
| Codex / generic | `AGENTS.md` section per role | one file, clearly sectioned |
| Copilot | `.github/prompts/<name>.prompt.md` | prompt files only |
| Pure chat | one paste-ready block per agent | user stores them |

Before writing: check the path for an existing definition and MERGE, marking
edits with `<!-- updated by Dev Kickoff [date] -->`. Never overwrite an agent
someone else wrote.

Agent definitions are always **English** (`artifact_lang`), whatever
`doc_lang` is.

## Step 4 — Agent content template

```
---
name: <role>
description: <one line — when this agent should be used>
---

# <Role> — [Project Name]

## Scope
<what this agent does, one paragraph>

## Project constraints (from the Decision Register)
- Stack: <exact versions>
- Conventions: <pointer to PDR §3, plus the 3 rules most often violated>
- NON-GOALS: <verbatim list — hard boundaries>
- Domain rules that must never be violated: <list>

## Inputs
project-memory/01-decision-register.md · 03-progress.md · <task id>

## Output contract
<exactly what this agent returns, and in what shape>

## Hard limits
- <the "must not" from the roster table>
- Any new binding decision → stop and ask the user; never decide silently.
```

## Step 5 — If the user wants an external agent harness installed

A third-party agent-harness system (its own agents, skills, hooks, and
memory vault) may already be installed globally, or the user may want one.
This skill does **not** bundle, vendor, or reimplement such a system, and it
never installs or configures one on its own initiative — even when the
session-level signal from Step 1 shows it is already on the machine.

**No harness installed anywhere (both signals absent), user wants one:**
point them at the official install path for the harness they name and let
them run it themselves — installation touches their global config, and
stacking install methods is the documented way to break it. After it is
installed, re-run Phase 2.

**Harness installed globally but not wired into this project (session signal
present, repo-file signal absent):** don't install anything — there's
nothing to install. Tell the user the harness is available on this machine and
ask whether they want this project wired into it (some harnesses need a
per-project init/link step, some just start working once their commands are
invoked in the repo — verify which, don't assume). If yes, that's still the
user's action to take or approve; once done, re-run Phase 2: detect it,
defer to it, and write only the project-specific layer. If no, proceed with
this skill's own roster (Step 2) and record the choice in
`01-decision-register.md` so a later session doesn't re-ask.

Either way, treat the harness's counts, command names, and install commands
as **verify-before-quoting**. Fast-moving projects change quickly; do not
state a command from memory. Check the repo docs at the time of use.

Attribution: if you adopt an external harness's loop or file layout in
project docs, credit it by name and link where its license requires it.

## Reflection add-on for the roster

Fold these into the Phase 2 Reflection block:

```
Gate R1: Harness detected and deferred to (or absence confirmed)?  [PASS/FAIL]
Gate R2: No agent duplicates a workflow the installed harness owns? [.]
Gate R3: reviewer isolated from implementer context?                [.]
Gate R4: verifier has no fix authority?                             [.]
Gate R5: Every agent file merged, not overwritten?                  [.]
```

## Scoping parallel agents (lesson from kelompok 2/3 execution)

Sharpened by this ecosystem's own experience running large parallel-agent
batches.

**Keep each parallel agent's scope small.** During a prior large porting
effort, a kelompok-2 batch of large, broadly-scoped parallel Sonnet agents
hit a session rate limit mid-task; the kelompok-3 batch used more, smaller,
narrowly-scoped agents (one file or one tightly-related file group each)
and completed without incident. Prefer more agents with less each over
fewer agents with more each — it is also easier to retry a small failed
task than to guess how far a large one got.

**Isolate the write surface.** Each dispatched agent should own a distinct
file or folder slice. Where the harness supports it, pair this with a
worktree or the write-scope freeze in `safe-execution-edho-ferdian` Gate 3
— the kelompok-3 batch found a real case of an agent leaving stray pointers
into files outside its assigned scope, caught and fixed by hand afterward.
A freeze turns that into a refusal at the moment it would happen instead of
a manual cleanup pass later.

**Give agents a way to look, not just what you guessed they need.**
A subagent often cannot know what context it actually needs until it starts
working. Rather than trying to front-load every fact it might want, give it
the tools and permission to
look things up itself (Grep/Glob/Read over the relevant subtree, or a
pointer to the specific memory files to check) and let it refine its own
understanding across a couple of passes, rather than treating the initial
prompt as the only chance to supply context.
