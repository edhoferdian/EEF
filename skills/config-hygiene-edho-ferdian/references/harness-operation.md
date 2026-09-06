# Harness Operation — Automation, Model Routing, Context Budget

## Provenance & why this file exists

Adapted from ECC `rules/common/hooks.md`, `rules/common/performance.md`, and
the 21 `rules/<lang>/hooks.md` files, fetched 2026-09-06. Same D-005 pattern
as `baseline-conventions.md` (D-032): these were still being loaded from the
ECC rule tree as active global instructions. This skill already owns the
`~/.claude` surface (SKILL.md §Scope), so the operating rules for that
surface belong here.

Extended 2026-09-06 (D-041) from three ECC surfaces that had never been
surveyed before — `hooks/README.md` (the hook authoring contract and policy
recipes in §1-§2), `docs/token-optimization.md` (the concrete settings knobs
in §4), and the `token-budget-advisor` / `cost-tracking` skills (§5). The
executable half of ECC's hook tree — `hooks/hooks.json`, `hooks/codex-hooks.json`,
`hooks/memory-persistence/`, and the ~53 scripts under `scripts/hooks/` they
dispatch into — is deliberately **not** ported: every command in it is an
inline bootstrap that resolves `CLAUDE_PLUGIN_ROOT` back into an ECC install,
which is anti-D-005 by definition. What is portable is the *contract* and the
*policy shapes*, which is what this file records.

This file is about running *the harness*. It is not about LLM calls inside a
product — that is
`backend-engineering-edho-ferdian/references/llm-pipelines.md`.

## 1. Hook lifecycle and the authoring contract

### 1.1 The six events

| Event | Fires | Can block? | Legitimate use | Misuse |
|---|---|---|---|---|
| `PreToolUse` | before a tool runs | **yes** (exit 2) | validation, refusing a destructive command, freezing a write scope | doing work the model should reason about |
| `PostToolUse` | after a tool returns | no | auto-format, typecheck, lint the file just written | anything slow enough to stall every edit |
| `Stop` | after each response | no | final sweep — debug statements, uncommitted secrets | anything the user needs to see mid-turn |
| `SessionStart` | session opens | no | load prior context, detect the package manager, surface unfinished work | dumping so much context that the budget in §5 is spent before the first prompt |
| `SessionEnd` | session closes | no | lifecycle marker, cleanup, persisting state | work that matters — nothing guarantees the operator ever sees the output |
| `PreCompact` | before compaction | no | save the decision register and constraints so compaction cannot drop them | anything expensive; compaction is already a stall |

The mechanical gates in `safe-execution-edho-ferdian` are the *policy* those
hooks enforce; this table is the *wiring*.

**A hook must be fast, idempotent, and silent on success.** A PostToolUse
hook that prints on every edit trains the operator to ignore hook output,
which is exactly when a real failure gets missed.

`SessionStart` deserves a separate warning. It is the one event whose output
is charged against every single turn that follows, so it is the easiest place
to quietly destroy a session: a hook that injects several thousand characters
of "helpful" context has spent part of §5's reserve before the operator has
typed anything. Cap what it emits, and prefer a pointer ("3 open items in
`project-memory/03-progress.md`") over the content itself.

### 1.2 The contract

A hook is a command that receives the tool call as JSON on **stdin** and must
write that same JSON back to **stdout**. Swallowing stdout breaks the chain
for every hook after it.

| Channel | Meaning |
|---|---|
| stdout | the (unmodified) input JSON, passed along |
| stderr | a message shown to the model — this is how a hook *warns* |
| exit 0 | success, continue |
| exit 2 | **block the tool call** — `PreToolUse` only; ignored elsewhere |
| other non-zero | error; logged, does not block |

Input shape: `tool_name` plus a `tool_input` whose fields depend on the tool
(`command` for a shell call; `file_path`, `old_string`/`new_string`, or
`content` for edits and writes), and — on `PostToolUse` only — a `tool_output`.

Two consequences worth stating plainly:

- **Exit 2 is the only real gate.** A `PostToolUse` hook cannot undo what
  already happened, so anything that must be *prevented* rather than
  *reported* belongs in `PreToolUse`. Writing an enforcement rule as a
  PostToolUse warning is a common and silent failure.
- **Mark slow hooks async.** A hook flagged async runs in the background and
  forfeits its ability to block — which is the correct trade for background
  analysis, and the wrong one for a guardrail. If a check must both be slow
  and must block, the answer is to make it cheaper, not to make it async.

Implement hook logic in a language that runs unmodified on Windows, macOS,
and Linux. This ecosystem's primary machine is Windows; a hook written as a
POSIX shell one-liner is a hook that silently never fires here, which is worse
than no hook at all because the operator believes it is protecting them.

### 1.3 Controlling hooks without editing them

A hook set that can only be changed by editing its definition will be
disabled wholesale the first time one of them is wrong. Build in three
levers from the start: a master on/off switch, a **profile** (`minimal` for
lifecycle and safety only, `standard` as the balanced default, `strict` for
extra guardrails), and a per-hook disable list keyed on stable hook IDs.
Give every hook an ID for exactly this reason.

## 2. Hook policy patterns worth wiring

These are the shapes worth stealing, independent of any particular harness.
Each names the event that makes it work — putting one on the wrong event is
how it becomes decorative.

| Policy | Event | Why it earns its cost |
|---|---|---|
| Block edits to linter/formatter config | `PreToolUse` (Edit/Write) | The failure mode it stops is the model weakening the rule instead of fixing the code — a change that passes CI *and* silently lowers the floor for everything after it. The highest-value hook in the set. |
| Block writes over a size limit | `PreToolUse` (Write) | Enforces the 800-line ceiling from `code-review-edho-ferdian/references/baseline-conventions.md` at the only moment it is cheap to enforce. |
| Warn on a new source file with no test | `PreToolUse` (Write) | Nudges toward the RED-GREEN order in `test-authoring-edho-ferdian/references/baseline-testing-standards.md` without blocking exploratory work. |
| Warn on a new `TODO`/`FIXME` with no issue reference | `PreToolUse` (Edit) | A TODO nobody filed is a decision deferred to nobody. |
| Refuse a long-running server outside a managed session | `PreToolUse` (Bash) | A dev server started in a foreground shell has unreadable logs and no clean way to stop it. |
| Warn before `git push` | `PreToolUse` (Bash) | The last reversible moment; pairs with `git-and-release-ops-edho-ferdian`. |
| Pre-commit sweep — staged-file lint, commit-message format, debug statements and secret patterns | `PreToolUse` (Bash) | Blocks the critical class, warns on the rest. |
| Format / typecheck the file just written | `PostToolUse` (Edit) | See the table in §3; scope it to the file. |
| Debug-statement sweep across modified files | `Stop` | Catches what per-edit hooks missed once the shape of the change is final. |
| Save constraints before compaction | `PreCompact` | See §5 — compaction drops the oldest context, which is usually the constraints. |

One anti-pattern is worth naming because it looks responsible: a
`PreToolUse` gate that blocks the *first* edit to every file and demands
investigation before allowing it. On a large task this fires dozens of times,
the operator learns the ritual that satisfies it, and it becomes a tax rather
than a gate. Prefer gates that fire rarely and mean something when they do.

## 3. Per-language PostToolUse formatting

Collapsed from ECC's 21 near-identical `rules/<lang>/hooks.md` files. The
pattern is the same everywhere — format on write, typecheck on write, warn
on debug statements — so it is one table, not 21 files.

| Stack | Format on write | Check on write | Warn on |
|---|---|---|---|
| TypeScript / JavaScript | prettier | `tsc --noEmit` | `console.log` |
| Python | ruff format (or black) | mypy / pyright | `print()` |
| Go | gofmt + goimports | `go vet` | — |
| Rust | `cargo fmt` | `cargo clippy` | `dbg!` / `println!` |
| Any | — | — | `TODO` added without an issue reference |

Two rules that matter more than the table:

- **Only wire a formatter the project itself already declares.** Adding
  prettier to a repo that uses biome, or black to a repo that uses ruff
  format, produces a diff war between the hook and the project's own CI.
  Read the manifest first.
- **A typecheck hook is scoped to the file, not the repo.** A full `tsc`
  run on every edit in a monorepo turns a two-second edit into a
  thirty-second one, and the operator will disable it within a day.

## 4. Model routing

Route by the *shape of the failure*, not by how hard the task feels.

| Tier | Use for | The tell |
|---|---|---|
| Haiku | high-frequency, narrow, verifiable work — extraction, classification, mechanical transforms, worker steps in a fan-out | a wrong answer is obvious and cheap to retry |
| Sonnet | the default: implementation, file writing, orchestration of a known plan | the work is well-specified and the cost of a retry is one task |
| Opus | architecture, cross-cutting triage, comparing options, research where being subtly wrong is expensive | a wrong answer is *plausible* and gets built on before anyone notices |

The dividing line is whether a wrong answer is **loud or quiet**. Loud
failures tolerate a cheaper model; quiet ones do not. This ecosystem's own
porting work has run on exactly this split — Opus for triage, Sonnet for
execution — and it held.

Escalate one tier when: the task spans more than a handful of files, an
earlier cheaper attempt produced something that looked right and was not, or
the output is a decision rather than an artifact.

### 4.1 The knobs that actually move cost

Routing is a habit; these are the settings that make the habit the default.
All three live in the harness settings file, which is in scope for this
skill's scan channels.

| Knob | Effect | Default posture |
|---|---|---|
| default model | Sets the tier for everything you did not think about. Sonnet, not the top tier — escalate per-task instead of paying the top rate for every file read. | Sonnet |
| extended-thinking budget | Reserves output tokens per request for internal reasoning, and the reserve is charged whether or not it is used. The stock ceiling is far above what routine work needs. | lower it well below the stock ceiling; raise it deliberately for architecture and triage |
| subagent model | Subagents fan out and are the highest-volume consumer in the harness. Most of what they do — reading files, running a search, executing a known check — is the Haiku row of the table above. | the cheap tier, overridden per-agent when a subagent is doing genuine reasoning |

The failure mode to avoid is tuning these once and forgetting them: a
thinking budget set low for a week of routine work is a bad setting on the
day a real architecture decision arrives, and nothing will tell you. Treat
the pairing of *default model* and *thinking budget* as a single setting with
two positions — routine and deep — and move both together.

## 5. Context budget

Reserve the last ~20% of the context window. Past that point the failure
mode is not refusal — it is silent degradation: earlier constraints stop
being applied, and the work looks fine.

**Do not start** in that zone: multi-file refactors, feature implementation
spanning several files, debugging an interaction across layers.

**Safe there:** single-file edits, an isolated utility, a doc update, a
small bug fix.

When approaching the limit mid-task, compact deliberately rather than
letting the window truncate — see §Strategic compaction in this skill's
SKILL.md. An automatic truncation drops the *oldest* context, which is
usually the decision register and the constraints; a deliberate compaction
keeps them.

### 5.1 Budget telemetry — measure the trend, not the turn

Folded here from ECC's `token-budget-advisor` and `cost-tracking` skills
(D-041): both are thin, both are about the same thing, and neither justifies
a skill of its own once §4.1 exists.

What is worth recording per session is small: which model tier ran, roughly
how much of the window was consumed, and whether the session ended in
compaction. What is *not* worth doing is surfacing a running cost estimate
mid-turn — a per-turn number is noise the operator cannot act on without
abandoning the task, and it trains exactly the same "ignore the hook output"
reflex as a chatty PostToolUse hook (§1.1).

The one signal that justifies interrupting: a session that has compacted
more than once. That is not a cost problem, it is a scoping problem — the
task was too large to hold, and the fix is to split it and write the
constraints down (see `dev-kickoff-edho-ferdian`'s session-snapshot pattern),
not to buy a bigger window.

## 6. Permission posture

- Widen permissions in the settings allowlist, deliberately and per-tool.
  Never reach for a blanket skip-permissions flag — it removes the
  distinction between "I approved this class of action" and "I approved
  everything", which is the only thing standing between an exploratory
  session and an unreviewed destructive command.
- Widen for **trusted, well-defined plans**. Narrow for exploratory work,
  which is exactly when an unexpected tool call is most likely.
- Every widened permission is config surface. It is in scope for this
  skill's scan channels: an allowlist entry nobody remembers adding is the
  same class of finding as an orphaned MCP server.

## 7. Todo lists as a steering surface

A written task list is not bookkeeping — it is the cheapest point at which
the operator can catch a misunderstanding, because it exposes the plan
before any file is touched. Read a freshly written list for: steps in the
wrong order, a missing step, an invented step nobody asked for, granularity
that hides the risky part inside a vague item, and any item that reveals the
requirement was misread.

Keep exactly one item in progress. A list with four items in progress has
stopped being a plan and become a log.
