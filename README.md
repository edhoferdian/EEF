# Ekosistem Edho Ferdian (EEF)

A native Claude Code skill ecosystem — 33 skills covering engineering
(backend, frontend, API design, data layer, security, performance, testing),
operations (deployment, containers, networking, git/release), and
cross-cutting practices (code review, spec mining, marketing, research).

Standalone by design — no external harness install, no dependency on
another project's paths or infrastructure.

## Install

Four ways to get these skills, pick whichever fits:

### Option A — npm (works for every harness this repo supports, no git needed)

```bash
npx eef-install                            # Claude Code, all 33 skills
npx eef-install code-review-edho-ferdian    # Claude Code, specific skills only
npx eef-install --target cursor             # Cursor, into ./.cursor/rules/
npx eef-install --target windsurf           # Windsurf + Devin
npx eef-install --target cline              # Cline
npx eef-install --target copilot            # GitHub Copilot
npx eef-install --target kiro                # Kiro (add --global for ~/.kiro)
npx eef-install --target hermes              # Hermes Agent (add --global for ~/.hermes)
npx eef-install --target openclaw            # OpenClaw (add --global for ~/.agents)
npx eef-install --target zcode                # ZCode (add --global for ~/.zcode)
npx eef-install --target agents-md          # AGENTS.md into the current project
npx eef-install --target gemini-md          # GEMINI.md into the current project
npx eef-install --list                      # list all skill names
npx eef-install --help
```

The package bundles the actual skill content (see
[`package.json`](package.json)'s `files` list) — no separate git clone, no
network access after the initial `npx` download. Source:
[`bin/eef.js`](bin/eef.js), zero runtime dependencies.

### Option B — Manual `.skill` upload

Each skill is pre-packaged as a `.skill` archive under [`dist/`](dist/).
Download the one(s) you want and upload through the Skills UI in Claude.ai,
Claude Desktop, or Claude Code. Good for trying a single skill without
touching your local `~/.claude` setup.

### Option C — Install script (copies into `~/.claude/skills/`)

Clone this repo, then run the installer for your platform:

```bash
# macOS / Linux / Git Bash
git clone https://github.com/edhoferdian/EEF.git
cd EEF
./install.sh                 # installs all 33 skills
./install.sh code-review-edho-ferdian dev-kickoff-edho-ferdian   # only specific ones
./install.sh --list          # see all installable skill names
```

```powershell
# Windows PowerShell
git clone https://github.com/edhoferdian/EEF.git
cd EEF
.\install.ps1                                    # installs all 33 skills
.\install.ps1 -Only code-review-edho-ferdian,dev-kickoff-edho-ferdian
.\install.ps1 -ListOnly
```

Set `CLAUDE_SKILLS_DIR` (env var, both platforms) to install somewhere other
than `~/.claude/skills`.

### Option D — Claude Code plugin marketplace

```
/plugin marketplace add edhoferdian/EEF
/plugin install ekosistem-edho-ferdian@eef-marketplace
```

This tracks the repo directly — updates land when the plugin/marketplace
`version` fields are bumped in [`.claude-plugin/`](.claude-plugin/).

> **Note:** this GitHub repo is currently private. Options C and D need
> read access to it. **Option A (npm) does not** — the npm registry is a
> separate distribution channel, so `npx eef-install` will work for anyone
> even while the repo itself stays private, same as Option B's packaged
> `.skill` files — once `eef-install` has had its first `npm publish`.

## Other harnesses (not just Claude Code)

These skills are plain Markdown with no Claude-specific syntax, so they
port to other coding agents with light, generated adapters — no manual
duplication, no drift, since every adapter is generated from `skills/` and
checked in CI (`export-targets-sync` job):

- **[AGENTS.md](AGENTS.md)** — the cross-vendor project-instructions file
  read automatically by Codex, OpenCode, Meta's Muse Code, and others that
  have converged on this convention. A compact router table, not a full
  copy — each row points at the matching `SKILL.md` to read on demand.
  Regenerate: `python scripts/export_agents_md.py`.
- **[.cursor/rules/](.cursor/rules/)** — one `.mdc` file per skill, Cursor's
  own multi-file rules format. Each carries the skill's `description` for
  Cursor's "Apply Intelligently" auto-matching, the same trigger semantics
  Claude Code uses. Regenerate: `python scripts/export_cursor.py`.
- **[.windsurf/rules/](.windsurf/rules/) and [.devin/rules/](.devin/rules/)**
  — one file per skill for Windsurf (Cascade) and Devin, which share an
  identical rules schema post-acquisition. `trigger: model_decision` gives
  the same relevance-based auto-loading as Cursor's `description` matching.
  Six skills exceed Windsurf's 12,000-character-per-file limit and are
  truncated with a pointer back to the full `SKILL.md` — a documented
  limitation, not silent data loss. Regenerate: `python scripts/export_windsurf.py`.
- **[.clinerules/](.clinerules/)** — a single always-on router file for
  Cline, matching AGENTS.md's shape (Cline's `paths:` frontmatter only
  supports file-glob scoping, not relevance-based matching, so 33 always-on
  full-body files would reinject every skill into every request; a small
  router avoids that). Cline also reads `AGENTS.md` automatically — this
  adapter mainly gives EEF its own toggleable entry in Cline's Rules panel.
  Regenerate: `python scripts/export_cline.py`.
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** —
  a router in the same shape as AGENTS.md, for GitHub Copilot (Chat, CLI,
  code review, cloud agent) — the single largest coding-agent user base by
  market share. Copilot's newer path-scoped `.github/instructions/*.md`
  mechanism was deliberately not used: this ecosystem's skills are
  workflow-triggered, not file-type-triggered, so a glob-based `applyTo`
  wouldn't fire reliably. Regenerate: `python scripts/export_copilot.py`.

- **[.kiro/skills/](.kiro/skills/)** — a generated copy for
  [Kiro](https://kiro.dev) (AWS's agentic IDE), which has no equivalent of
  Claude's Skill-loading mechanism and expects skill folders physically
  present under its own `.kiro/skills/`. See [.kiro/README.md](.kiro/README.md)
  for the install command. Regenerate: `python scripts/export_kiro.py`.

- **[GEMINI.md](GEMINI.md)** — byte-identical to `AGENTS.md`, generated
  from it (`scripts/export_gemini_md.py`), because Gemini CLI looks for
  this specific filename by default and doesn't fall back to `AGENTS.md`.

- **[.hermes/skills/](.hermes/skills/)** — a generated copy for
  [Hermes Agent](https://hermes-agent.nousresearch.com) (Nous Research).
  Regenerate: `python scripts/export_hermes.py` (`--global` for
  `~/.hermes/skills/` instead of project-local).
- **[.agents/skills/](.agents/skills/)** — a generated copy for
  [OpenClaw](https://openclaw.ai). Regenerate:
  `python scripts/export_openclaw.py` (`--global` for `~/.agents/skills/`).
- **[.zcode/skills/](.zcode/skills/)** — a generated copy for
  [ZCode](https://z.ai) (Z.ai's desktop coding agent, GLM Coding Plan).
  Confirmed directly against the installed app's own resources, not
  assumed: its packed source checks for a `/.zcode/skills/` path when
  classifying skill sources, and its onboarding flow migrates an existing
  `CLAUDE.md` into `AGENTS.md` — so this ecosystem's own `AGENTS.md` export
  already covers ZCode's project-instructions half too. Regenerate:
  `python scripts/export_zcode.py` (`--global` for `~/.zcode/skills/`).

Hermes, Kiro, OpenClaw, and ZCode's copy-based adapters all work the same
way for the same reason: their skill format is
[agentskills.io](https://agentskills.io)'s open standard — the same
`SKILL.md` + `name`/`description` frontmatter format this ecosystem
already uses, originally developed by Anthropic and now adopted by dozens
of agent products. No content transform is needed for any tool on that
list; only a correctly-shaped copy in the right directory.

Every adapter above is generated, never hand-maintained, and CI fails if
any of them drifts from `skills/`. Several harnesses need no adapter at
all — confirmed via each tool's own docs, not assumed: `AGENTS.md` alone
already covers Codex, OpenCode, Muse Code (Meta), Cline, Zed, Google
Antigravity, and ZCode, and [Pi](https://github.com/earendil-works/pi-coding-agent)
resolves a standard `skills/` folder directly
(`pi install git:edhoferdian/EEF`) with no generated files at all.

## Agent orchestration (experimental)

A second, newer layer alongside `skills/` — for the harnesses that support
*sub-agent delegation* (a scoped-down persona with its own tool access,
callable mid-task) rather than only single-agent instructions:

- **[`agents/`](agents/)** — canonical agent definitions (`AGENT.md`:
  `name`/`description`/`tools`/`model` frontmatter + a system-prompt body).
  Each agent stays thin on purpose — it delegates to the matching
  `-edho-ferdian` skill for actual review/task criteria rather than
  duplicating them, so the two layers can't drift apart.
- **[`workflows/`](workflows/)** — named multi-agent recipes (pipeline /
  parallel shape) referencing agents by name, generalized from patterns
  already used inline in skills like `gan-harness-edho-ferdian` and
  `code-review-edho-ferdian`'s Critique-Correction Loop.

**`model:` is Claude Code-only.** Its value ("sonnet", "opus", ...) is a
Claude Code-specific alias — every other harness's generator deliberately
omits the field so the agent inherits that harness's own default model,
instead of failing to resolve an alias it doesn't recognize (reproduced by
hand against ZCode before this policy existed: setting `model: "sonnet"`
there made the agent fail to load).

Sub-agent delegation is **not** a cross-tool standard the way `SKILL.md` is
— every harness that has it defines the format itself, so this layer is
generated per harness like `skills/` is, not copied verbatim. Install with
`eef-install` the same way as the skills layer:

```bash
npx eef-install --target claude-agents      # ~/.claude/agents/ (or $CLAUDE_AGENTS_DIR)
npx eef-install --target opencode-agents    # merges into ./opencode.json ($schema/mcp/etc untouched, --global for ~/.config/opencode)
npx eef-install --target zcode-agents       # adds to ~/.zcode/agents/, your own agents there untouched
```

- **[.claude/agents/](.claude/agents/)** — Claude Code's own native
  subagent format; a straight 1:1 mapping since `AGENT.md` already *is*
  that format. Regenerate: `python scripts/export_agents_claude.py`.
- **dist/agents/opencode/** — a `{name}.agent.json` fragment + prompt file
  per agent, for OpenCode's `agent.<name>` block in `opencode.json`.
  `eef-install --target opencode-agents` merges the `"agent"` key in
  without touching any other key in that file (a consumer's own MCP
  servers and other config live in the same file) — verified against a
  live `opencode.json` that already had its own `mcp` block and an
  unrelated agent before the merge, both intact after. Regenerate:
  `python scripts/export_agents_opencode.py`.
- **[.hermes/skills/agent-delegation-edho-ferdian/](.hermes/skills/agent-delegation-edho-ferdian/)**
  — Hermes has no static per-agent file format at all (confirmed against
  its own `tools/delegate_tool.py` source: `delegate_task` is dynamic and
  goal-based, and its only persistent named-agent primitive, Bot Mode
  profiles, is a full provisioned directory this script has no business
  generating). Instead this is a generated **skill** — a delegate_task()
  call template per canonical agent, so Hermes' primary agent has a ready
  roster instead of improvising a persona each time. Regenerate:
  `python scripts/export_agents_hermes.py` (`--global` for
  `~/.hermes/skills/`).
- **dist/agents/zcode/** — one `.md` per agent in ZCode's own native
  Subagent format (`name`/`description`/`injectAgentsMd` frontmatter +
  system-prompt body), confirmed against a real file ZCode itself wrote
  through its "New Agent" dialog, not guessed. `eef-install --target
  zcode-agents` copies these into `~/.zcode/agents/` alongside — never
  over — anything already there (no confirmed project-local equivalent
  exists, unlike `.zcode/skills/`). Regenerate:
  `python scripts/export_agents_zcode.py`.

**Every skill has an agent counterpart** (`python
scripts/generate_agent_stubs.py`, 33/33) — not because every task needs
delegation, but because *whether* a given task needs it is a runtime call
(a small task stays in the main thread with the skill; a substantial,
multi-file, or context-isolation-worthy task delegates to the agent), not
a fixed split baked into which skills exist in agent form. Most stubs are
deliberately thin wrappers that delegate straight back to their skill for
actual criteria — `code-reviewer-edho-ferdian` is the one hand-tuned
exception, kept as the pilot. A small allowlist of pure review/audit/lens
agents (`code-reviewer-edho-ferdian`, `security-review-edho-ferdian`,
`language-code-review-edho-ferdian`, `skill-audit-edho-ferdian`,
`click-path-audit-edho-ferdian`) gets read-only tools instead of the
default full set — a delegated reviewer that structurally *can't* write
anything is a stronger isolation guarantee than one that merely shouldn't.
Nested delegation (an agent calling another agent, not just a skill) isn't
wired up yet — it needs an explicit per-harness capability check first
(does the harness even let a sub-agent re-delegate, and if so, a
leaf/orchestrator guard against runaway recursion — see Hermes'
`delegate_task` role system for the pattern this ecosystem would mirror).

**Some skills split into more than one agent, hand-tuned rather than
generated**, when an internal phase's own instructions demand real context
isolation from another phase — a same-context "pretend you don't remember"
instruction isn't the same guarantee as a genuinely separate delegate:

- `gan-harness-edho-ferdian`'s Generate and Evaluate phases →
  `gan-generator-edho-ferdian` / `gan-evaluator-edho-ferdian`, because the
  Evaluator must score the Generator's work without having seen the
  Generator's own reasoning about it.
- `opensource-release-edho-ferdian`'s Phase 2 audit →
  `opensource-sanitizer-edho-ferdian`, because that phase's own rule is
  "never open FORK_REPORT.md" — only enforceable if the phase never shared
  a context with the report's author in the first place.
- `code-review-edho-ferdian`'s Phase 4 Critique-Correction Loop →
  `code-reviewer-edho-ferdian` (Agent A, already the pilot) and
  `code-critic-edho-ferdian` (Agent B) — B gets only the code and A's
  draft report, never A's Phase 1-3 reasoning, so the critique is a real
  adversarial check instead of the same model agreeing with itself. Both
  delegations are made by whatever orchestrates the review (dev-kickoff,
  another agent, or the user) — **not** A delegating to B directly, since
  nested agent-to-agent delegation isn't a verified capability on every
  harness yet (see the note above).

The skill still keeps its own whole-pipeline agent too (delegating the
*entire* run as one unit, e.g. several gan-harness loops in parallel) —
the phase-specific agents are for the isolation guarantee *within* one
run, not a replacement for the whole-pipeline form.

Only one pilot agent exists today (`code-reviewer-edho-ferdian`) and one
pilot workflow (`review-then-verify-edho-ferdian`) — this layer is still
being validated before more of the roster gets ported.

## Skills

See [`skills/`](skills/) — one folder per skill, each a `SKILL.md` plus a
`references/` directory. Skill names ending in `-edho-ferdian` are this
ecosystem's own naming convention, so they don't collide with a
similarly-scoped skill from any other package you have installed.

## Repo layout

```
.claude-plugin/     plugin.json + marketplace.json (Option D)
.github/            CI workflow + FUNDING.yml
.cursor/, .windsurf/, .devin/, .clinerules/, .kiro/, .zcode/
                     generated per-harness adapters, see scripts/export_*.py
AGENTS.md, GEMINI.md generated cross-vendor router files
skills/              source of truth — 33 skill folders
agents/, workflows/  canonical sub-agent + multi-agent-workflow definitions (experimental)
dist/                packaged .skill archives (Option B), one per skill; also dist/agents/opencode/
bin/eef.js           npm CLI entry point (Option A)
scripts/             packaging + validation + cross-harness export scripts
install.sh           installer (macOS/Linux/Git Bash, Option C)
install.ps1          installer (Windows PowerShell, Option C)
package.json         npm package manifest (Option A)
CODE_OF_CONDUCT.md, CONTRIBUTING.md, SECURITY.md
```

## Sponsors

EEF is free — sponsoring funds the time to keep porting stacks and closing
gaps. See [SPONSORS.md](SPONSORS.md) for tiers, or sponsor directly via
[GitHub Sponsors](https://github.com/sponsors/edhoferdian).

## Enterprise inquiry

Need a custom skill for your team's internal stack, faster response than a
GitHub issue, or help rolling this out to more than a couple of engineers?
Open an issue titled "Enterprise inquiry" or email
edhoferdian31@gmail.com — no fixed package, we figure out what actually
fits your team.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and required
checks. Everyone participating is expected to follow the
[Code of Conduct](CODE_OF_CONDUCT.md). Found a security issue? See
[SECURITY.md](SECURITY.md) instead of opening a public issue.

## License

[MIT](LICENSE).

