#!/usr/bin/env python3
"""Generate .hermes/skills/<name>/SKILL.md (+ references/) for Hermes Agent
(Nous Research, hermes-agent.nousresearch.com).

Hermes Agent's skill format follows the agentskills.io open standard
(originally developed by Anthropic, released openly, now adopted by dozens
of agent products — confirmed directly against agentskills.io and Hermes'
own docs) — a folder with SKILL.md carrying `name`/`description`
frontmatter, exactly what this ecosystem already ships. No content
transformation needed, same reasoning as scripts/export_kiro.py.

Confirmed directory locations (hermes-agent.nousresearch.com docs):
- Global (source of truth): ~/.hermes/skills/
- Project-local: .hermes/skills/ or .agents/skills/ within a git repo root

This script defaults to project-local `.hermes/skills/` (pass --global for
the global `~/.hermes/skills/` instead), matching export_kiro.py's own
default/--global split.

Usage:
    python scripts/export_hermes.py               # write .hermes/skills/ (project-local)
    python scripts/export_hermes.py --global        # write ~/.hermes/skills/ instead
    python scripts/export_hermes.py --check          # exit 1 if stale
"""
import argparse
import shutil
import sys
from pathlib import Path

from lib_skills import REPO_ROOT, load_skills
from export_agents_hermes import SKILL_NAME as AGENT_ROUTER_SKILL_NAME


def dir_contents(d: Path) -> dict:
    if not d.is_dir():
        return {}
    return {p.relative_to(d).as_posix(): p.read_bytes() for p in d.rglob("*") if p.is_file()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if stale instead of writing")
    parser.add_argument("--global", dest="global_", action="store_true", help="write to ~/.hermes/skills/ instead of ./.hermes/skills/")
    args = parser.parse_args()

    dest_root = (Path.home() / ".hermes" / "skills") if args.global_ else (REPO_ROOT / ".hermes" / "skills")

    skills = load_skills()
    ok = True

    for s in skills:
        dest = dest_root / s.name
        if dir_contents(s.dir) == dir_contents(dest):
            continue
        if args.check:
            print(f"STALE: {dest}")
            ok = False
            continue
        if dest.exists():
            shutil.rmtree(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(s.dir, dest)
        print(f"Copied: {s.name}")

    if dest_root.is_dir():
        # AGENT_ROUTER_SKILL_NAME (agent-delegation-edho-ferdian) is written
        # by export_agents_hermes.py into this same directory, not by this
        # script — exclude it from the orphan sweep so the two generators
        # don't fight over the same folder (see agents/README, if present,
        # for why Hermes needs a separate generated router skill instead of
        # a per-agent file like Claude Code/OpenCode get).
        wanted_names = {s.name for s in skills} | {AGENT_ROUTER_SKILL_NAME}
        for existing in dest_root.iterdir():
            if existing.is_dir() and existing.name not in wanted_names:
                if args.check:
                    print(f"STALE (orphaned): {existing.name}/")
                    ok = False
                else:
                    shutil.rmtree(existing)
                    print(f"Removed orphaned: {existing.name}/")

    if args.check:
        print(f"{dest_root} is in sync." if ok else "\nRun: python scripts/export_hermes.py")
    else:
        print(f"Done. {len(skills)} skill(s) copied to {dest_root}.")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
