# Phase 3 — Packaging Templates

Reference for Phase 3 of `opensource-release-edho-ferdian`. Adapted from
ECC `opensource-packager`, fetched 2026-09-04.

## Preconditions — do not skip

Phase 3 only runs after Phase 2 (`sanitize-audit.md`) returns **PASS** or a
**PASS-WITH-WARNINGS** the user has explicitly accepted (see that file's
hard-gate section). If you land in this file without a passing
`SANITIZATION_REPORT.md` in hand, stop and go run Phase 2 first — packaging
a project that hasn't cleared the audit is exactly the failure mode this
skill's three-phase split exists to prevent.

Your goal in this phase: anyone should be able to clone the sanitized
project, run `setup.sh`, and be productive within minutes — especially with
Claude Code.

## Step 1 — Project analysis

Read and understand, from the sanitized `TARGET_DIR`, not the original
source:

- `package.json` / `requirements.txt` / `Cargo.toml` / `go.mod` (stack
  detection).
- `docker-compose.yml` (services, ports, dependencies).
- `Makefile` / `Justfile` (existing commands).
- Existing `README.md` (preserve useful content — enhance, don't replace).
- Source structure (entry points, key directories).
- `.env.example` produced by Phase 1 (required configuration).
- Test framework in use (jest, pytest, vitest, go test, cargo test, etc.).

## Step 2 — Generate `CLAUDE.md`

**This reuses this ecosystem's own Execution Context Pack format** (see
`dev-kickoff-edho-ferdian`'s `references/context-pack-memory.md`) — it does
not invent a separate template. A packaged open-source repo is itself a
project someone will pick up with an AI coding tool, which is exactly what
the Context Pack format is for. Two constraints apply on top of that shared
format, both inherited from ECC's original packager and worth keeping:

- **Under 100 lines.** ECC's packager enforces this and the reasoning still
  holds — `CLAUDE.md` is read on every session start; verbosity there is a
  standing token cost, not a one-time one.
- Every command listed must be copy-pasteable and verified against the
  actual project, not guessed at.

Because of the 100-line ceiling, use the **Cursor/trim variant** guidance
from `context-pack-memory.md`'s "Target variants" table as the model for
how aggressively to compress, but keep the Claude Code file name
(`CLAUDE.md`) and keep the sections that make a freshly-cloned repo legible
to an AI with zero prior context:

```markdown
# {Project Name}

**Version:** {version} | **Port:** {port} | **Stack:** {detected stack}

## A. What
{1-2 sentence description — no marketing language}

## Quick Start

\`\`\`bash
./setup.sh              # First-time setup
{dev command}           # Start development server
{test command}          # Run tests
\`\`\`

## Commands

\`\`\`bash
# Development
{install command}
{dev server command}
{lint command}
{build command}

# Testing
{test command}
{coverage command}

# Docker
cp .env.example .env
docker compose up -d --build
\`\`\`

## Architecture

\`\`\`
{directory tree of key folders, one-line descriptions each}
\`\`\`

{2-3 sentences: what talks to what, data flow.}

## Key Files

\`\`\`
{5-10 most important files with their purpose}
\`\`\`

## Configuration

All configuration is via environment variables — see \`.env.example\`:

| Variable | Required | Description |
|----------|----------|--------------|
{table derived from .env.example}

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
```

Rules carried over from ECC (still correct, keep them):

- Every command must be copy-pasteable and correct — verify each one
  against the actual project before writing it down; a wrong command in
  `CLAUDE.md` is worse than no command.
- The architecture section should fit in a terminal window without
  scrolling.
- List files that actually exist in the sanitized tree, never hypothetical
  ones.
- Put the port number somewhere prominent.
- If Docker is the primary runtime, lead with the Docker commands, not the
  bare-metal ones.
- Never include an internal reference, secret, or anything Phase 1/2
  stripped — re-check this file specifically before finishing, since it's
  the one file most likely to accidentally quote a real path or example
  value copied from the original source during drafting.

## Step 3 — Generate `setup.sh`

One-command bootstrap. Must work on a fresh clone with zero manual steps
beyond editing `.env`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# {Project Name} — First-time setup
# Usage: ./setup.sh

echo "=== {Project Name} Setup ==="

# Check prerequisites
command -v {package_manager} >/dev/null 2>&1 || { echo "Error: {package_manager} is required."; exit 1; }

# Environment
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — edit it with your values"
fi

# Dependencies
echo "Installing dependencies..."
{npm install | pip install -r requirements.txt | cargo build | go mod download}

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Edit .env with your configuration"
echo "  2. Run: {dev command}"
echo "  3. Open: http://localhost:{port}"
echo "  4. Using Claude Code? CLAUDE.md has all the context."
```

After writing, `chmod +x setup.sh`.

Rules:

- `set -euo pipefail` for safety — fail loudly, don't limp along.
- Check prerequisites with a clear, actionable error message before doing
  any work.
- Echo progress so the person running it knows what's happening.
- Never assume a package manager — detect it from the stack analysis in
  Step 1, don't hardcode `npm` for a project that uses `pnpm` or `yarn`.

## Step 4 — Generate or enhance `README.md`

If a good `README.md` already exists in the sanitized tree, **enhance it,
don't replace it** — preserve whatever is still accurate, add what's
missing (this mirrors the merge rule `dev-kickoff-edho-ferdian` already
applies to `CLAUDE.md`/`AGENTS.md`: never blind-overwrite content someone
already wrote).

```markdown
# {Project Name}

{Description — 1-2 sentences}

## Features

- {Feature 1}
- {Feature 2}
- {Feature 3}

## Quick Start

\`\`\`bash
git clone https://github.com/{org}/{repo}.git
cd {repo}
./setup.sh
\`\`\`

See [CLAUDE.md](CLAUDE.md) for detailed commands and architecture.

## Prerequisites

- {Runtime} {version}+
- {Package manager}

## Configuration

\`\`\`bash
cp .env.example .env
\`\`\`

Key settings: {3-5 most important env vars}

## Development

\`\`\`bash
{dev command}     # Start dev server
{test command}    # Run tests
\`\`\`

## Using with Claude Code

This project includes a \`CLAUDE.md\` that gives Claude Code full context.

\`\`\`bash
claude    # Start Claude Code — reads CLAUDE.md automatically
\`\`\`

## License

{License type} — see [LICENSE](LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)
```

Do not duplicate `CLAUDE.md` content in the README — link to it instead.
The "Using with Claude Code" section is not optional; it's what makes the
packaging output distinct from a bare `git init`.

## Step 5 — LICENSE selection

Ask the user which license applies if it isn't already obvious from the
original project or an explicit instruction. Do not silently default to
MIT — license choice is a real decision with legal consequences the user
should make consciously, even if MIT is the common answer.

Quick guidance for the conversation (not a substitute for the user's own
judgment or counsel):

| License | When it fits |
|---|---|
| MIT | Maximum permissiveness, minimal obligations on reusers. Default choice for most small/medium tools. |
| Apache-2.0 | Like MIT plus an explicit patent grant — worth it if the project could plausibly touch patent-sensitive territory. |
| GPL-3.0 / AGPL-3.0 | Copyleft — forces derivative works (AGPL: including network-service use) to stay open. Only if the user specifically wants to prevent proprietary forks. |
| Unlicense / CC0 | Public domain equivalent — rare, only if the user explicitly wants to give up all rights. |
| No LICENSE file | Legally means "all rights reserved" even on a public GitHub repo — never leave this as the default; confirm the user actually intends a proprietary-but-visible repo before doing so. |

Use the standard SPDX text for the chosen license. Set the copyright holder
to the current year plus "Contributors" unless the user gives a specific
name or organization.

## Step 6 — Generate `CONTRIBUTING.md`

```markdown
# Contributing to {Project Name}

Thanks for your interest in contributing.

## Development Setup

\`\`\`bash
git clone https://github.com/{org}/{repo}.git
cd {repo}
./setup.sh
\`\`\`

## Branch & PR Workflow

1. Fork the repo and create a branch from `main`.
2. Make your change, following the code style notes below.
3. Add or update tests for behavior you changed.
4. Open a pull request describing what changed and why.

## Code Style

{Notes derived from the actual project analysis — linter config in use,
naming conventions observed, test framework and coverage expectations.}

## Reporting Issues

Use the issue templates under `.github/ISSUE_TEMPLATE/` — include steps to
reproduce, expected vs. actual behavior, and your environment.

## Using Claude Code

This repo ships a `CLAUDE.md` with full project context. Running `claude`
in the repo root picks it up automatically.
```

## Step 7 — GitHub issue templates

Create these under `.github/ISSUE_TEMPLATE/` whenever the target is a
GitHub repo (or `.github/` already exists in the sanitized tree):

`.github/ISSUE_TEMPLATE/bug_report.md`:

```markdown
---
name: Bug report
about: Report something that isn't working
title: "[Bug] "
labels: bug
---

**Describe the bug**
A clear description of what's wrong.

**Steps to reproduce**
1.
2.
3.

**Expected behavior**
What you expected to happen instead.

**Environment**
- OS:
- {Runtime} version:
- {Project name} version/commit:

**Additional context**
Logs, screenshots, anything else relevant.
```

`.github/ISSUE_TEMPLATE/feature_request.md`:

```markdown
---
name: Feature request
about: Suggest an idea for this project
title: "[Feature] "
labels: enhancement
---

**Problem**
What problem would this feature solve? Is it related to a limitation you
ran into?

**Proposed solution**
What you'd like to see happen.

**Alternatives considered**
Any alternative approaches or workarounds you've thought about.

**Additional context**
Anything else relevant.
```

## Output

Report to the user:

- Files generated, with line counts.
- Files enhanced (what was preserved vs. what was added) rather than
  replaced.
- Confirmation `setup.sh` was made executable.
- Any command in `CLAUDE.md`/`setup.sh` that could not be verified against
  the actual source — flag it rather than silently including a guess.

## Rules

- Never include an internal reference, secret, or PII in any generated
  file — Phase 2 already gated on this, but re-verify locally: a value
  copied into `CLAUDE.md` or `README.md` during drafting is a fresh
  introduction, not something Phase 2 already checked.
- Always verify every command placed in `CLAUDE.md` or `setup.sh` actually
  exists in the sanitized project — read the real `package.json` scripts,
  `Makefile` targets, etc., don't guess at conventional names.
- Always make `setup.sh` executable.
- Always include the "Using with Claude Code" section in the README.
- Read the actual project code to understand its architecture — don't
  infer it from the file tree alone.
- If the project already has good docs, enhance them; don't discard
  existing accurate content to impose the template verbatim.
- `CLAUDE.md`'s Context Pack format lives in
  `dev-kickoff-edho-ferdian/references/context-pack-memory.md` — if that
  format changes, this file's Step 2 should be re-checked for drift rather
  than maintaining a second copy of the same template's intent.
