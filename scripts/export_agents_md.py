#!/usr/bin/env python3
"""Generate AGENTS.md — the cross-vendor project-instructions file that
Codex, OpenCode, Meta's Muse Code, and several other terminal coding agents
read automatically (Claude Code falls back to CLAUDE.md if AGENTS.md is
absent, and reads AGENTS.md instead when present, per the emerging
convention several vendors have converged on independently).

None of those tools have Claude Code's "Skill" progressive-disclosure
mechanism (a skill's full body only loads into context when the agent
decides to consult it) — they read one instructions file wholesale, every
turn. So this file is deliberately NOT a dump of all 33 skills' full
content (that would burn a huge amount of context on every single turn
regardless of relevance). Instead it's a router: a compact table of every
skill's name, trigger description, and path, with one instruction telling
the agent to read the matching SKILL.md when a request matches before
acting on it. This reproduces the same two-tier loading shape (cheap
always-on metadata, full content on demand) using nothing but "read this
file when relevant" — every one of these tools can already do that.

Usage:
    python scripts/export_agents_md.py            # write AGENTS.md
    python scripts/export_agents_md.py --check     # exit 1 if stale
"""
import argparse
import sys

from lib_skills import REPO_ROOT, load_skills

DEST = REPO_ROOT / "AGENTS.md"

HEADER = """\
# AGENTS.md — Ekosistem Edho Ferdian (EEF)

This project ships 33 skills under `skills/*/SKILL.md` — each one a focused
playbook for a specific engineering task (code review, API design, test
authoring, deployment, and more). This file is a router, not a full copy:
skim the table below, and when a request matches a row, **read that skill's
`SKILL.md` file before acting** — it has the actual workflow, checklists,
and reference material this index intentionally leaves out to stay small.

A skill's own `references/*.md` files go one level deeper still; its
`SKILL.md` tells you when to open those too. Don't guess at a skill's
method from its one-line description here — read the file.

## Skills

| Skill | Use when | Path |
|---|---|---|
"""

FOOTER = """

## Notes for non-Claude-Code harnesses

- These skills were authored for Claude Code's Agent Skills format, but the
  content itself is plain Markdown with no Claude-specific syntax — reading
  a `SKILL.md` file directly works the same way here as it does there.
- If this harness also supports a native rules/instructions directory
  (`.cursor/rules/`, `.windsurf/rules/`, `.clinerules/`, etc.), check
  whether this repo ships an adapter for it under `scripts/export_*.py`
  before assuming this router file is the only option.
"""


def truncate(text: str, limit: int = 140) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return f"{cut}…"


def build_content() -> str:
    skills = load_skills()
    rows = []
    for s in skills:
        one_line = truncate(s.description)
        # Escape pipe characters so they don't break the Markdown table.
        one_line = one_line.replace("|", "\\|")
        rows.append(f"| `{s.name}` | {one_line} | `skills/{s.name}/SKILL.md` |")
    return HEADER + "\n".join(rows) + FOOTER


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if AGENTS.md is stale instead of writing it")
    args = parser.parse_args()

    wanted = build_content()
    current = DEST.read_text(encoding="utf-8", newline=None) if DEST.exists() else None

    if current == wanted:
        print("AGENTS.md is in sync." if args.check else "AGENTS.md already up to date.")
        return 0

    if args.check:
        print("STALE: AGENTS.md does not match skills/ — run: python scripts/export_agents_md.py")
        return 1

    DEST.write_text(wanted, encoding="utf-8")
    print(f"Wrote AGENTS.md ({len(load_skills())} skills).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
