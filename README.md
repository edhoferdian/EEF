# Ekosistem Edho Ferdian (EEF)

A native Claude Code skill ecosystem — 33 skills covering engineering
(backend, frontend, API design, data layer, security, performance, testing),
operations (deployment, containers, networking, git/release), and
cross-cutting practices (code review, spec mining, marketing, research).

Standalone by design — no external harness install, no dependency on
another project's paths or infrastructure.

## Install

Three ways to get these skills, pick whichever fits:

### Option A — Manual `.skill` upload

Each skill is pre-packaged as a `.skill` archive under [`dist/`](dist/).
Download the one(s) you want and upload through the Skills UI in Claude.ai,
Claude Desktop, or Claude Code. Good for trying a single skill without
touching your local `~/.claude` setup.

### Option B — Install script (copies into `~/.claude/skills/`)

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

### Option C — Claude Code plugin marketplace

```
/plugin marketplace add edhoferdian/EEF
/plugin install ekosistem-edho-ferdian@eef-marketplace
```

This tracks the repo directly — updates land when the plugin/marketplace
`version` fields are bumped in [`.claude-plugin/`](.claude-plugin/).

> **Note:** this repo is currently private. Anyone installing via Option B
> or C needs read access to it; Option A's packaged `.skill` files can be
> shared independently of repo access.

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

Every adapter above is generated, never hand-maintained, and CI fails if
any of them drifts from `skills/`. Two harnesses need no adapter at all:
[Pi](https://github.com/earendil-works/pi-coding-agent) resolves a
standard `skills/` folder directly (`pi install git:edhoferdian/EEF`) with
no generated files required, and several tools (Codex, OpenCode, Muse
Code) read `AGENTS.md` natively.

## Skills

See [`skills/`](skills/) — one folder per skill, each a `SKILL.md` plus a
`references/` directory. Skill names ending in `-edho-ferdian` are this
ecosystem's own naming convention, so they don't collide with a
similarly-scoped skill from any other package you have installed.

## Repo layout

```
.claude-plugin/     plugin.json + marketplace.json (Option C)
.github/            CI workflow + FUNDING.yml
.cursor/rules/      generated — Cursor adapter, see export_cursor.py
AGENTS.md            generated — cross-vendor router, see export_agents_md.py
skills/              source of truth — 33 skill folders
dist/                packaged .skill archives (Option A), one per skill
scripts/             packaging + validation + cross-harness export scripts
install.sh           installer (macOS/Linux/Git Bash)
install.ps1          installer (Windows PowerShell)
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

## License

[MIT](LICENSE).

