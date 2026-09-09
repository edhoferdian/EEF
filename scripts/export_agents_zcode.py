#!/usr/bin/env python3
"""Generate dist/agents/zcode/*.md — one file per canonical agent under
agents/, in ZCode's own native Subagent format.

Confirmed against a real file ZCode itself wrote (not guessed from source
alone): the user created one subagent through ZCode's own "New Agent"
dialog, and the resulting ~/.zcode/agents/test.md was:

    ---
    name: "test"
    description: "testing agent"
    color: yellow
    injectAgentsMd: true
    ---

    ini test ya

Cross-checked against ZCode's packed app resources (app.asar), whose parser
builds `{agent: {name, description, systemPrompt: <body>, ...color?,
...model?, ...thoughtLevel?}}` — confirming `model` is a real frontmatter
key when set. This script deliberately never sets it: AGENT.md's `model:`
value ("sonnet", "opus", ...) is a Claude Code-specific alias, and copying
it verbatim into ZCode's `model` field made ZCode fail to resolve the model
when the pilot agent was actually invoked there (confirmed by hand — not a
theoretical concern). Every harness other than Claude Code gets no `model`
field at all and inherits whatever model ZCode/the harness has configured
as default, exactly like leaving that field blank in ZCode's own "New
Agent" dialog. `tools` was NOT found written into any real file — ZCode's
tool-scoping is inheritAllTools/selectedTools/preservedTools, a materially
different shape from Claude Code's flat `tools:` list, so this script does
not attempt to map it either; every generated agent inherits all tools by
omission, same as leaving that field blank too.

This deliberately writes to dist/agents/zcode/ (checked into the repo,
CI-verified) rather than directly into the live, machine-specific
~/.zcode/agents/ — the same reasoning as export_agents_opencode.py not
writing directly into a consumer's opencode.json: ~/.zcode/agents/ is a
real directory the user manages through ZCode's own UI (it already held
the user's own hand-created test.md when this was verified), and a
--check-gated generator that runs in CI has no business writing outside
the repo. Installing dist/agents/zcode/*.md into ~/.zcode/agents/ is a
separate, explicit copy step (a future `eef-install --target zcode-agents`,
or manual for now) — this script never deletes anything in that directory.
No confirmed project-local equivalent exists for ZCode's Subagent feature,
unlike .zcode/skills/.

Usage:
    python scripts/export_agents_zcode.py            # write dist/agents/zcode/*.md
    python scripts/export_agents_zcode.py --check      # exit 1 if stale
"""
import argparse
import sys

from lib_agents import REPO_ROOT, Agent, load_agents

DEST_DIR = REPO_ROOT / "dist" / "agents" / "zcode"


def agent_md_content(agent: Agent) -> str:
    desc_escaped = agent.description.replace('"', '\\"')
    frontmatter = (
        "---\n"
        f'name: "{agent.name}"\n'
        f'description: "{desc_escaped}"\n'
        "injectAgentsMd: true\n"
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
        print("dist/agents/zcode/ is in sync." if ok else "\nRun: python scripts/export_agents_zcode.py")
    else:
        print(f"Done. {len(wanted)} agent(s) written to dist/agents/zcode/.")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
