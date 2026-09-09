#!/usr/bin/env python3
"""Generate .kiro/skills/<name>/SKILL.md (+ references/) — a Kiro
(kiro.dev, AWS's agentic IDE) skills copy.

Kiro's own skill format is byte-compatible with ours (both follow the
Agent Skills standard: SKILL.md + frontmatter + optional references/), so
no content transformation happens here — this is a straight copy of every
skill folder into .kiro/skills/<name>/, generated fresh every run.

Why generated instead of hand-maintained (the ECC precedent got this
wrong): ECC's own .kiro/skills/ is a SEPARATELY hand-edited copy of its
root skills/ — diffing one skill between the two locations showed real
content drift (different description, extra sections in the Kiro copy)
that nobody was keeping in sync. Generating .kiro/skills/ from skills/ on
every run, and checking it in CI the same way every other export_*.py
target is checked, makes that drift structurally impossible here.

Kiro also supports agents/hooks/steering files, none of which this
ecosystem has (it's skills-only) — so unlike ECC's full .kiro/ scaffold,
this only ever populates .kiro/skills/.

Usage:
    python scripts/export_kiro.py            # write .kiro/skills/
    python scripts/export_kiro.py --check     # exit 1 if stale
"""
import argparse
import shutil
import sys

from lib_skills import REPO_ROOT, load_skills


DEST_DIR = REPO_ROOT / ".kiro" / "skills"


def dir_contents(d) -> dict:
    """{relative_posix_path: bytes} for every file under d, read directly
    (not via filecmp's shallow stat-based comparison, which can be fooled
    by mtime differences between a freshly-copied directory and its
    source) — this is the same explicit-byte-comparison approach used by
    scripts/package_skills.py's build_manifest(), for the same reason.
    """
    if not d.is_dir():
        return {}
    return {p.relative_to(d).as_posix(): p.read_bytes() for p in d.rglob("*") if p.is_file()}


def skill_is_in_sync(skill_dir, dest_dir) -> bool:
    return dir_contents(skill_dir) == dir_contents(dest_dir)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if .kiro/skills/ is stale instead of writing it")
    args = parser.parse_args()

    skills = load_skills()
    ok = True

    for s in skills:
        dest = DEST_DIR / s.name
        if skill_is_in_sync(s.dir, dest):
            continue
        if args.check:
            print(f"STALE: .kiro/skills/{s.name}/")
            ok = False
            continue
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(s.dir, dest)
        print(f"Copied: {s.name}")

    # Remove any leftover skill folder for a skill that no longer exists.
    if DEST_DIR.is_dir():
        wanted_names = {s.name for s in skills}
        for existing in DEST_DIR.iterdir():
            if existing.is_dir() and existing.name not in wanted_names:
                if args.check:
                    print(f"STALE (orphaned): .kiro/skills/{existing.name}/")
                    ok = False
                else:
                    shutil.rmtree(existing)
                    print(f"Removed orphaned: .kiro/skills/{existing.name}/")

    if args.check:
        print(".kiro/skills/ is in sync." if ok else "\nRun: python scripts/export_kiro.py")
    else:
        print(f"Done. {len(skills)} skill(s) copied to .kiro/skills/.")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
