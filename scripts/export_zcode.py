#!/usr/bin/env python3
"""Generate .zcode/skills/<name>/SKILL.md (+ references/) for ZCode
(Z.ai's desktop coding agent, GLM Coding Plan).

Confirmed directly against the installed ZCode app (not guessed): its
packed resources (app.asar) contain a live path check —
`t.includes('/.zcode/skills/')` — used to classify skill sources, and its
onboarding flow offers to migrate an existing CLAUDE.md into AGENTS.md
(`onboarding.agentsFile.copyTitle: "Copy CLAUDE.md to AGENTS.md"`),
confirming ZCode reads AGENTS.md as its project-instructions file the same
way Codex/OpenCode do — this ecosystem's existing AGENTS.md export already
covers that half, no new script needed for it.

The skills format itself needed no research: ZCode's skill directory is
byte-compatible with the Agent Skills standard (SKILL.md + frontmatter +
optional references/), same as Kiro/Hermes/OpenClaw — see export_kiro.py
for why this is generated fresh every run instead of hand-maintained.

`~/.zcode/skills/` (global) was not found to exist on the machine this was
verified against, so this script defaults to project-local `.zcode/skills/`
(matching Cursor/Windsurf's own project-local convention) and only writes
the global path on explicit `--global`, same opt-in shape as
export_hermes.py / export_openclaw.py.

Usage:
    python scripts/export_zcode.py               # write .zcode/skills/ (project-local)
    python scripts/export_zcode.py --global        # write ~/.zcode/skills/ instead
    python scripts/export_zcode.py --check          # exit 1 if stale
"""
import argparse
import shutil
import sys
from pathlib import Path

from lib_skills import REPO_ROOT, load_skills


def dir_contents(d: Path) -> dict:
    if not d.is_dir():
        return {}
    return {p.relative_to(d).as_posix(): p.read_bytes() for p in d.rglob("*") if p.is_file()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if stale instead of writing")
    parser.add_argument("--global", dest="global_", action="store_true", help="write to ~/.zcode/skills/ instead of ./.zcode/skills/")
    args = parser.parse_args()

    dest_root = (Path.home() / ".zcode" / "skills") if args.global_ else (REPO_ROOT / ".zcode" / "skills")

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
        wanted_names = {s.name for s in skills}
        for existing in dest_root.iterdir():
            if existing.is_dir() and existing.name not in wanted_names:
                if args.check:
                    print(f"STALE (orphaned): {existing.name}/")
                    ok = False
                else:
                    shutil.rmtree(existing)
                    print(f"Removed orphaned: {existing.name}/")

    if args.check:
        print(f"{dest_root} is in sync." if ok else "\nRun: python scripts/export_zcode.py")
    else:
        print(f"Done. {len(skills)} skill(s) copied to {dest_root}.")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
