#!/usr/bin/env python3
"""Generate .cursor/rules/*.mdc — one file per skill, Cursor's own
multi-file rules format (closer to Claude Skills' shape than a single
flat instructions file: each .mdc gets its own `description` field Cursor
uses for "Apply Intelligently" auto-matching, the same semantics as a
Claude Skill's frontmatter description).

Confirmed against Cursor's current .mdc schema: `description` (used for
agent-driven matching), `globs` (file-pattern auto-attach — left empty
here, since these are workflow skills, not file-type-triggered style
rules), `alwaysApply` (bool, default false — left false so a skill only
loads when its description matches, not on every single request).

Each .mdc's body is the skill's own SKILL.md body, verbatim — including
its `references/*.md` pointers, which still resolve correctly as long as
the target project also has this repo's `skills/<name>/references/`
directory present (the install flow that copies `.cursor/rules/` should
also copy the matching `skills/<name>/` folder, not just the .mdc file,
the same way this ecosystem's own install.sh copies whole skill folders
rather than SKILL.md alone).

Usage:
    python scripts/export_cursor.py            # write all .cursor/rules/*.mdc
    python scripts/export_cursor.py --check     # exit 1 if stale
"""
import argparse
import sys

from lib_skills import FRONTMATTER_RE, REPO_ROOT, Skill, load_skills

DEST_DIR = REPO_ROOT / ".cursor" / "rules"


def mdc_content(skill: Skill) -> str:
    raw = skill.skill_md.read_text(encoding="utf-8", newline=None)
    m = FRONTMATTER_RE.search(raw)
    body = raw[m.end():] if m else raw

    # Cursor's YAML frontmatter needs the description as a single scalar;
    # collapse our >- folded-block style into one line and escape quotes.
    desc_escaped = skill.description.replace('"', '\\"')
    frontmatter = (
        "---\n"
        f'description: "{desc_escaped}"\n'
        "globs:\n"
        "alwaysApply: false\n"
        "---\n"
    )
    return frontmatter + body


def target_path(skill: Skill):
    return DEST_DIR / f"{skill.name}.mdc"


def build_all() -> dict:
    return {target_path(s): mdc_content(s) for s in load_skills()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if any .mdc is stale instead of writing them")
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

    # Remove any leftover .mdc for a skill that no longer exists.
    if DEST_DIR.is_dir():
        wanted_names = {p.name for p in wanted}
        for existing in DEST_DIR.glob("*.mdc"):
            if existing.name not in wanted_names:
                if args.check:
                    print(f"STALE (orphaned): {existing.relative_to(REPO_ROOT)}")
                    ok = False
                else:
                    existing.unlink()
                    print(f"Removed orphaned: {existing.relative_to(REPO_ROOT)}")

    if args.check:
        print(".cursor/rules/ is in sync." if ok else "\nRun: python scripts/export_cursor.py")
    else:
        print(f"Done. {len(wanted)} .mdc file(s) processed.")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
