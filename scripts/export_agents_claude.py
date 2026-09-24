#!/usr/bin/env python3
"""Generate .claude/agents/*.md — one file per canonical agent under
agents/, in Claude Code's own native subagent format (frontmatter: name,
description, tools, model; body: system prompt).

Nearly a 1:1 mapping — Claude Code's subagent format IS the canonical
agents/*/AGENT.md format this ecosystem writes agents in. The only
reshaping is Claude-specific: the canonical comma-separated `skills:`
becomes a YAML list (which Claude Code preloads), `Skill` is added to
tools, and a short install-location note is appended to the body. See
CLAUDE_LOCATION_NOTE below for why.

Usage:
    python scripts/export_agents_claude.py            # write .claude/agents/*.md
    python scripts/export_agents_claude.py --check     # exit 1 if stale
"""
import argparse
import sys

from lib_agents import REPO_ROOT, Agent, load_agents

DEST_DIR = REPO_ROOT / ".claude" / "agents"


# Claude Code-only additions, kept out of the canonical AGENT.md so other
# harnesses' exports never inherit them:
#   - `skills:` preloads each wrapped skill's full SKILL.md into the
#     subagent's context at startup, so it never has to locate the file.
#     Before this existed, subagents told to "load the skill" had no path
#     and no Skill tool, and fell back to `find / -name SKILL.md` — on
#     Windows that scanned the whole drive for hours per delegation.
#   - `Skill` in tools lets the subagent load the *other* skills its
#     wrapped skill cross-references, instead of hunting for them on disk.
#   - CLAUDE_LOCATION_NOTE gives the concrete install paths for the
#     references/ files a preloaded SKILL.md points at.
CLAUDE_LOCATION_NOTE = """\

## Skill location on Claude Code

Each wrapped skill's SKILL.md is already preloaded into your context (via
this agent's `skills:` frontmatter). Their `references/` files live at
`~/.claude/skills/<skill-name>/references/` (user install) or
`.claude/skills/<skill-name>/references/` under the project root — read
them from there directly. Load any other skill it points you to with the
Skill tool.
"""


def claude_tools(agent: Agent) -> str:
    tools = [t.strip() for t in agent.tools.split(",") if t.strip()]
    if agent.skills and "Skill" not in tools:
        tools.append("Skill")
    return ", ".join(tools)


def agent_md_content(agent: Agent) -> str:
    skills_yaml = "".join(f"  - {s}\n" for s in agent.skills)
    frontmatter = (
        "---\n"
        f"name: {agent.name}\n"
        f"description: {agent.description}\n"
        f"tools: {claude_tools(agent)}\n"
        + (f"skills:\n{skills_yaml}" if agent.skills else "")
        + f"model: {agent.model}\n"
        "---\n\n"
    )
    note = CLAUDE_LOCATION_NOTE if agent.skills else ""
    return frontmatter + agent.body + "\n" + note


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
