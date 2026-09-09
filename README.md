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

## Skills

See [`skills/`](skills/) — one folder per skill, each a `SKILL.md` plus a
`references/` directory. Skill names ending in `-edho-ferdian` are this
ecosystem's own naming convention, so they don't collide with a
similarly-scoped skill from any other package you have installed.

## Repo layout

```
.claude-plugin/     plugin.json + marketplace.json (Option C)
.github/            CI workflow + FUNDING.yml
skills/              source of truth — 33 skill folders
dist/                packaged .skill archives (Option A), one per skill
scripts/             packaging script CI and local dev both use
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

