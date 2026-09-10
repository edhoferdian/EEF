#!/usr/bin/env python3
"""Generate a single Hermes skill that documents how to realize this
ecosystem's canonical agents/*/AGENT.md roster using Hermes' own
`delegate_task` tool.

Hermes has no static per-agent file format (confirmed against Hermes'
official docs and its own tools/delegate_tool.py source, not guessed):
- `delegate_task` is dynamic and goal-based — the calling model writes a
  "focused system prompt built from the delegated goal + context" at call
  time. There is no named-persona roster file it reads from; only two
  roles exist ("leaf", "orchestrator" — see DELEGATE_BLOCKED_TOOLS and
  _normalize_role in delegate_tool.py).
- Bot Mode / profiles (~/.hermes/profiles/<name>/) IS a named, persistent
  roster, but each entry is a full profile directory (own memory, skills,
  credentials, chat history) provisioned via `hermes profile create` or the
  desktop UI — not a file this script can safely generate or overwrite.

So instead of forcing a file-based export where none exists, this script
generates ONE skill (matching the same "single router file" pattern
export_cline.py already uses for a harness with no per-item relevance
matching) that gives Hermes' primary agent a ready-to-use delegate_task()
call template per canonical agent — the system prompt text comes straight
from each AGENT.md's body, so it can never drift from the canonical
definition.

Usage:
    python scripts/export_agents_hermes.py               # write .hermes/skills/agent-delegation-edho-ferdian/SKILL.md
    python scripts/export_agents_hermes.py --global        # write to ~/.hermes/skills/... instead
    python scripts/export_agents_hermes.py --check          # exit 1 if stale
"""
import argparse
import sys
from pathlib import Path

from lib_agents import REPO_ROOT, Agent, load_agents

SKILL_NAME = "agent-delegation-edho-ferdian"


def build_skill_md(agents: list[Agent]) -> str:
    parts = [
        "---\n",
        f"name: {SKILL_NAME}\n",
        "description: >-\n",
        "  Realize this ecosystem's named agent roster (agents/*/AGENT.md in the\n",
        "  edho-ferdian ecosystem) inside Hermes, which has no static per-agent\n",
        "  file format of its own. Use this whenever a task calls for delegating\n",
        "  to one of the named roles below via Hermes' delegate_task tool, instead\n",
        '  of writing an ad-hoc delegation prompt from scratch.\n',
        "---\n\n",
        "# Agent Delegation — Edho Ferdian Mode (Hermes)\n\n",
        "Hermes' `delegate_task` tool is goal-based, not roster-based — it has no\n",
        "file listing named agents the way Claude Code's `agents/*.md` or\n",
        "OpenCode's `opencode.json` agent block do. This skill is the roster:\n",
        "for each named agent below, call `delegate_task` with `role=\"leaf\"` and\n",
        "pass the agent's system prompt as the goal/context, instead of\n",
        "improvising a new persona each time the same role is needed again.\n\n",
        "Generated from this ecosystem's canonical `agents/*/AGENT.md` — never\n",
        "hand-edit this file, regenerate it instead\n",
        "(`python scripts/export_agents_hermes.py`) so it can't drift from the\n",
        "canonical definitions the other harnesses' agents are also generated\n",
        "from.\n\n",
    ]

    for a in agents:
        parts.append(f"## {a.name}\n\n")
        parts.append(f"**When to delegate here:** {a.description}\n\n")
        parts.append("```python\n")
        parts.append("delegate_task(\n")
        parts.append('    role="leaf",\n')
        parts.append(f'    goal="<the specific task for {a.name}>",\n')
        parts.append('    context=(\n')
        for line in a.body.splitlines():
            escaped = line.replace('\\', '\\\\').replace('"', '\\"')
            parts.append(f'        "{escaped}\\n"\n')
        parts.append("    ),\n")
        parts.append(")\n")
        parts.append("```\n\n")

    return "".join(parts)


def target_path(global_: bool) -> Path:
    root = (Path.home() if global_ else REPO_ROOT) / ".hermes" / "skills" / SKILL_NAME
    return root / "SKILL.md"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if stale instead of writing")
    parser.add_argument("--global", dest="global_", action="store_true", help="write to ~/.hermes/skills/ instead of ./.hermes/skills/")
    args = parser.parse_args()

    agents = load_agents()
    dest = target_path(args.global_)
    content = build_skill_md(agents)

    current = dest.read_text(encoding="utf-8", newline=None) if dest.exists() else None
    if current == content:
        print(f"{dest} is in sync.")
        return 0

    if args.check:
        print(f"STALE: {dest}")
        print("\nRun: python scripts/export_agents_hermes.py")
        return 1

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(content, encoding="utf-8")
    print(f"Wrote: {dest} ({len(agents)} agent(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
