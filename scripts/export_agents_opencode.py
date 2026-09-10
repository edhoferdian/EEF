#!/usr/bin/env python3
"""Generate OpenCode's agent artifacts from agents/*/AGENT.md.

OpenCode has no per-agent file format the way Claude Code does — a
sub-agent is a `agent.<name>` block inside the project's own opencode.json
(confirmed against a real opencode.json: `mode`, `prompt: {file:...}`,
`tools: {read, write, edit, bash}`), so this script does NOT write directly
into a consumer's opencode.json — that file also carries the consumer's own
MCP servers and other config, and overwriting it wholesale is exactly the
mistake this ecosystem's own ECC-decommissioning pass had to route around.

Instead this script writes two per-agent artifacts, merged into a
consumer's own opencode.json by `eef-install --target opencode-agents`
(see bin/eef.js) rather than overwritten in one shot:
  - dist/agents/opencode/prompts/<name>.txt   the system prompt body
  - dist/agents/opencode/<name>.agent.json    the `agent.<name>` block,
    referencing the prompt file by its OpenCode-relative path

No `model` field is ever emitted here: AGENT.md's `model:` value is a
Claude Code-specific alias ("sonnet", "opus", ...) that OpenCode's model
registry doesn't recognize — every harness other than Claude Code inherits
its own default model instead of getting a value it can't resolve (the
same failure this policy prevents was reproduced by hand against ZCode,
see export_agents_zcode.py).

Usage:
    python scripts/export_agents_opencode.py            # write dist/agents/opencode/*
    python scripts/export_agents_opencode.py --check     # exit 1 if stale
"""
import argparse
import json
import sys

from lib_agents import REPO_ROOT, Agent, load_agents

DEST_DIR = REPO_ROOT / "dist" / "agents" / "opencode"
# Mirrors the deployed layout exactly: the .agent.json fragment's "prompt"
# field reads "{file:prompts/agents/<name>.txt}", a path relative to a
# consumer's own opencode.json — so the source tree here has to carry the
# same "prompts/agents/" nesting, not a flat "prompts/", or the installer
# copies files to a path OpenCode's {file:...} reference can't find.
PROMPTS_DIR = DEST_DIR / "prompts" / "agents"

# Claude Code tool names -> OpenCode's boolean tool-permission keys.
# OpenCode's schema (confirmed against a real opencode.json) only has
# read/write/edit/bash/changed-files, not Claude Code's Grep/Glob split —
# both collapse into "read" since OpenCode's "read" tool covers file
# discovery and content access together.
_READ_TOOLS = {"Read", "Grep", "Glob"}


def opencode_tools(claude_tools: str) -> dict:
    names = {t.strip() for t in claude_tools.split(",") if t.strip()}
    return {
        "read": bool(names & _READ_TOOLS),
        "write": "Write" in names,
        "edit": "Edit" in names,
        "bash": "Bash" in names,
    }


def prompt_path(agent: Agent):
    return PROMPTS_DIR / f"{agent.name}.txt"


def agent_json_path(agent: Agent):
    return DEST_DIR / f"{agent.name}.agent.json"


def agent_block(agent: Agent) -> dict:
    # OpenCode grants every subagent its "task" tool (nested delegation) by
    # default, confirmed live via `opencode debug agent <name>` against this
    # package's own installed agents — including ones with no `Agent` in
    # their Claude Code tools: at all. That's more permissive than this
    # ecosystem's own leaf/orchestrator design, which deliberately restricts
    # nested delegation to the agents whose isolation-critical sub-phase
    # actually needs it (see README's "agent orchestration" section). Set
    # permission.task explicitly per agent so OpenCode's behavior matches
    # Claude Code's Agent-tool gating instead of silently diverging from it.
    can_orchestrate = "Agent" in [t.strip() for t in agent.tools.split(",") if t.strip()]
    return {
        "agent": {
            agent.name: {
                "description": agent.description,
                "mode": "subagent",
                "prompt": f"{{file:prompts/agents/{agent.name}.txt}}",
                "tools": opencode_tools(agent.tools),
                "permission": {"task": {"*": "allow" if can_orchestrate else "deny"}},
            }
        }
    }


def build_all() -> dict:
    wanted = {}
    for a in load_agents():
        wanted[prompt_path(a)] = a.body + "\n"
        wanted[agent_json_path(a)] = json.dumps(agent_block(a), indent=2) + "\n"
    return wanted


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if any artifact is stale instead of writing them")
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

    if args.check:
        print("dist/agents/opencode/ is in sync." if ok else "\nRun: python scripts/export_agents_opencode.py")
    else:
        print(f"Done. {len(wanted)} artifact(s) written to dist/agents/opencode/.")
        print("Note: this script never writes directly into a consumer's opencode.json.")
        print("Run `eef-install --target opencode-agents` to merge these in safely,")
        print("or merge the .agent.json block's \"agent\" key in by hand.")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
