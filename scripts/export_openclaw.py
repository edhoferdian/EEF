#!/usr/bin/env python3
"""Generate .agents/skills/<name>/SKILL.md (+ references/) for OpenClaw
(openclaw.ai).

OpenClaw's skill format follows the agentskills.io open standard, same as
Hermes Agent and Kiro (confirmed directly against docs.openclaw.ai) — a
folder with SKILL.md carrying `name`/`description` frontmatter, exactly
what this ecosystem already ships. No content transformation needed.

Confirmed directory precedence (docs.openclaw.ai, highest to lowest):
  1. <workspace>/skills        (per-agent — bare `skills/` at project root,
                                 skipped here: too likely to collide with a
                                 user's own unrelated `skills/` folder)
  2. <workspace>/.agents/skills  (project-agent — used by this script by default)
  3. ~/.agents/skills            (personal-agent — used with --global)
  4+ state-dir / workshop / bundled paths — not applicable to a plain
     folder-copy install.

`.agents/skills` is also a path Hermes Agent's own docs recognize as a
valid project-local skills location — using the same destination for both
adapters isn't a coincidence to fix, it's the tools already converging on
one convention.

Usage:
    python scripts/export_openclaw.py               # write .agents/skills/ (project-local)
    python scripts/export_openclaw.py --global        # write ~/.agents/skills/ instead
    python scripts/export_openclaw.py --check          # exit 1 if stale
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
    parser.add_argument("--global", dest="global_", action="store_true", help="write to ~/.agents/skills/ instead of ./.agents/skills/")
    args = parser.parse_args()

    dest_root = (Path.home() / ".agents" / "skills") if args.global_ else (REPO_ROOT / ".agents" / "skills")

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
        print(f"{dest_root} is in sync." if ok else "\nRun: python scripts/export_openclaw.py")
    else:
        print(f"Done. {len(skills)} skill(s) copied to {dest_root}.")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
