#!/usr/bin/env python3
"""Generate .claude/agents/*.md — one file per canonical agent under
agents/, in Claude Code's own native subagent format (frontmatter: name,
description, tools, model; body: system prompt).

This is a straight 1:1 mapping — Claude Code's subagent format IS the
canonical agents/*/AGENT.md format this ecosystem writes agents in, so no
transformation is needed beyond copying frontmatter fields and body
verbatim. Unlike skills/, which need per-harness reshaping, an AGENT.md
*is* a .claude/agents/*.md file already; this script only relocates it.

Usage:
    python scripts/export_agents_claude.py            # write .claude/agents/*.md
    python scripts/export_agents_claude.py --check     # exit 1 if stale
"""
import argparse
import sys

from lib_agents import REPO_ROOT, Agent, load_agents

DEST_DIR = REPO_ROOT / ".claude" / "agents"


def agent_md_content(agent: Agent) -> str:
    frontmatter = (
        "---\n"
        f"name: {agent.name}\n"
        f"description: {agent.description}\n"
        f"tools: {agent.tools}\n"
        f"model: {agent.model}\n"
        "---\n\n"
    )
    return frontmatter + agent.body + "\n"


def target_path(agent: Agent):
    return DEST_DIR / f"{agent.name}.md"


def build_all() -> dict:
    return {target_path(a): agent_md_content(a) for a in load_agents()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if any agent .md is stale instead of writing them")
    args = parser.parse_args()

    wanted = build_all()
    ok = True

    for dest, content in wanted.items():
        current = dest.read_text(encoding="utf-8", newline=None) if dest.exists() else None
        if current == content:
            continue
        if args.check:
            print(f"STALE: {dest.relative_to(REPO_ROOT)}")
            ok = False
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")
        print(f"Wrote: {dest.relative_to(REPO_ROOT)}")

    if DEST_DIR.is_dir():
        wanted_names = {p.name for p in wanted}
        for existing in DEST_DIR.glob("*.md"):
            if existing.name not in wanted_names:
                if args.check:
                    print(f"STALE (orphaned): {existing.relative_to(REPO_ROOT)}")
                    ok = False
                else:
                    existing.unlink()
                    print(f"Removed orphaned: {existing.relative_to(REPO_ROOT)}")

    if args.check:
        print(".claude/agents/ is in sync." if ok else "\nRun: python scripts/export_agents_claude.py")
    else:
        print(f"Done. {len(wanted)} agent(s) written to .claude/agents/.")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
