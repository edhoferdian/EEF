#!/usr/bin/env python3
"""Generate dist/agents/codex/*.toml — one Codex custom-agent file per
canonical agent under agents/, installed by `eef-install --target
codex-agents` into `.codex/agents/` (or `~/.codex/agents/` with --global).

Codex reads one standalone TOML file per custom agent with `name`,
`description` and `developer_instructions`, plus any config.toml key
(confirmed against openai/codex's agent-role parser on 2026-10-07). That
parser is `deny_unknown_fields`: a single key Codex does not know rejects
the whole file, so this script emits only keys known to exist there —
never an EEF-only field like `tier` or `skills`.

Field mapping:
  - model / model_reasoning_effort come from the default profile in
    agents/model-profiles.json (D-060); `eef-install --profile` rewrites
    both lines for the other profiles at install time.
  - sandbox_mode is "read-only" for agents with no Write/Edit tool (the
    review/audit agents) — the same isolation guarantee their Claude Code
    tool list gives — and "workspace-write" for everything else.

Usage:
    python scripts/export_agents_codex.py            # write dist/agents/codex/*.toml
    python scripts/export_agents_codex.py --check     # exit 1 if stale
"""
import argparse
import sys
import tomllib

from lib_agents import REPO_ROOT, Agent, load_agents, load_profiles, resolve_model

DEST_DIR = REPO_ROOT / "dist" / "agents" / "codex"

_WRITE_TOOLS = {"Write", "Edit"}

# Codex has no `skills:` preload, so the agent is told where an installed
# skill lives instead of being left to search for it (the D-055 failure).
CODEX_LOCATION_NOTE = """\

## Skill location on Codex

The skill(s) this agent wraps are installed as agentskills.io folders at
`.agents/skills/<skill-name>/` under the project root, or
`~/.agents/skills/<skill-name>/` for a user-level install
(`eef-install --target openclaw`, `--global` for the user level). Open that
folder's `SKILL.md` and its `references/` directly from there.
"""


def toml_string(value: str) -> str:
    """A TOML basic string, escaped per the TOML spec."""
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def toml_multiline(value: str) -> str:
    """A TOML multi-line basic string. Backslashes are escaped so Markdown
    backslashes survive verbatim, and every run of three quotes is broken
    up so it can never close the string early."""
    escaped = value.replace("\\", "\\\\").replace('"""', '""\\"')
    return f'"""\n{escaped}"""'


def sandbox_mode(agent: Agent) -> str:
    tools = {t.strip() for t in agent.tools.split(",") if t.strip()}
    return "workspace-write" if tools & _WRITE_TOOLS else "read-only"


def instructions(agent: Agent) -> str:
    """developer_instructions: the agent body plus, for a skill wrapper,
    where that skill is installed."""
    return agent.body + "\n" + (CODEX_LOCATION_NOTE if agent.skills else "")


def agent_toml(agent: Agent, profiles: dict) -> str:
    model, effort = resolve_model(agent, "codex", profiles)
    lines = [
        f"name = {toml_string(agent.name)}",
        f"description = {toml_string(agent.description)}",
        f"model = {toml_string(model)}",
    ]
    if effort:
        lines.append(f"model_reasoning_effort = {toml_string(effort)}")
    lines.append(f"sandbox_mode = {toml_string(sandbox_mode(agent))}")
    lines.append(f"developer_instructions = {toml_multiline(instructions(agent))}")
    return "\n".join(lines) + "\n"


def target_path(agent: Agent):
    return DEST_DIR / f"{agent.name}.toml"


def build_all() -> dict:
    """{dest: (toml content, the instructions it must parse back to)}."""
    profiles = load_profiles()
    return {target_path(a): (agent_toml(a, profiles), instructions(a)) for a in load_agents()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if any agent .toml is stale instead of writing them")
    args = parser.parse_args()

    wanted = build_all()
    ok = True

    for dest, (content, expected) in wanted.items():
        # Round-trip every file through a real TOML parser so an escaping
        # bug fails here, not inside a consumer's Codex session.
        if tomllib.loads(content)["developer_instructions"] != expected:
            print(f"BROKEN ESCAPING: {dest.relative_to(REPO_ROOT)}")
            ok = False
            continue
        current = dest.read_text(encoding="utf-8", newline=None) if dest.exists() else None
        if current == content:
            continue
        if args.check:
            print(f"STALE: {dest.relative_to(REPO_ROOT)}")
            ok = False
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8", newline="\n")
        print(f"Wrote: {dest.relative_to(REPO_ROOT)}")

    if DEST_DIR.is_dir():
        wanted_names = {p.name for p in wanted}
        for existing in DEST_DIR.glob("*.toml"):
            if existing.name not in wanted_names:
                if args.check:
                    print(f"STALE (orphaned): {existing.relative_to(REPO_ROOT)}")
                    ok = False
                else:
                    existing.unlink()
                    print(f"Removed orphaned: {existing.relative_to(REPO_ROOT)}")

    if args.check:
        print("dist/agents/codex/ is in sync." if ok else "\nRun: python scripts/export_agents_codex.py")
    else:
        print(f"Done. {len(wanted)} agent(s) written to dist/agents/codex/.")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
