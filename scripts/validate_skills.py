#!/usr/bin/env python3
"""Structural checks for skills/*/SKILL.md, run by CI on every push/PR.

Checks (all must pass):
1. Frontmatter — every SKILL.md has valid YAML-shaped frontmatter with a
   non-empty `name` and `description`.
2. Description length — `description` must be <=1024 chars (unconfirmed
   as an official hard limit, but this ecosystem was bitten twice by
   descriptions drifting past it silently, so it's enforced here rather
   than relying on someone remembering to check).
3. No "ECC" mentions outside two exempt skills — config-hygiene-edho-ferdian
   (its "ECC decommissioning track" names real path names on a user's disk,
   a functional reference, not attribution) and skill-authoring-edho-ferdian
   (its §6 documents this very policy, so it has to be able to name the
   word it bans). Everywhere else this ecosystem has zero relationship with
   ECC by explicit decision, and this guard exists so that decision doesn't
   silently regress.
4. Broken references — a `references/<file>.md` mention where <file>.md
   doesn't exist ANYWHERE under any skill's references/ folder is almost
   certainly a typo or a stale filename, not a stylistic choice. This is
   deliberately narrower than a full cross-skill-reference audit (which
   needs human judgment on prose context) — it only fails on names that
   don't exist anywhere in the repo, which is unambiguous.

What this deliberately does NOT check (left to periodic manual
skill-audit-edho-ferdian runs, since they need human judgment and are
prone to false positives in CI): staleness of provenance dates,
description vagueness/redundancy, absolute local paths, secret-shaped
strings. See skills/skill-audit-edho-ferdian/ for those.
"""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"
MAX_DESC_LEN = 1024
# config-hygiene-edho-ferdian: functional exception, its "ECC decommissioning
# track" names real ~/.claude paths that literally contain "ecc".
# skill-authoring-edho-ferdian: documents this very policy (§6), so its own
# SKILL.md has to be able to spell out the banned word to explain the rule.
ECC_EXEMPT_SKILLS = {"config-hygiene-edho-ferdian", "skill-authoring-edho-ferdian"}

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
DESC_BLOCK_RE = re.compile(r"^description:\s*>-\n((?:  .+\n?)+)", re.MULTILINE)
DESC_INLINE_RE = re.compile(r"^description:\s*(.+)$", re.MULTILINE)
NAME_RE = re.compile(r"^name:\s*(.+)$", re.MULTILINE)
REF_MENTION_RE = re.compile(r"references/([A-Za-z0-9_./-]+\.md)")


def check_frontmatter_and_description(errors: list[str]) -> None:
    for skill_md in sorted(SKILLS_DIR.glob("*/SKILL.md")):
        rel = skill_md.relative_to(REPO_ROOT)
        content = skill_md.read_text(encoding="utf-8")
        m = FRONTMATTER_RE.search(content)
        if not m:
            errors.append(f"{rel}: no valid --- frontmatter block found")
            continue
        fm = m.group(1)

        name_m = NAME_RE.search(fm)
        if not name_m or not name_m.group(1).strip():
            errors.append(f"{rel}: missing or empty `name` in frontmatter")

        desc_m = DESC_BLOCK_RE.search(fm)
        if desc_m:
            desc = " ".join(line.strip() for line in desc_m.group(1).splitlines())
        else:
            inline_m = DESC_INLINE_RE.search(fm)
            desc = inline_m.group(1).strip() if inline_m else ""

        if not desc:
            errors.append(f"{rel}: missing or empty `description` in frontmatter")
            continue
        if len(desc) > MAX_DESC_LEN:
            errors.append(f"{rel}: description is {len(desc)} chars, exceeds {MAX_DESC_LEN}")


def check_ecc_mentions(errors: list[str]) -> None:
    for md_file in sorted(SKILLS_DIR.rglob("*.md")):
        rel = md_file.relative_to(REPO_ROOT)
        if rel.parts[1] in ECC_EXEMPT_SKILLS:
            continue
        content = md_file.read_text(encoding="utf-8")
        for i, line in enumerate(content.splitlines(), 1):
            if "ECC" in line:
                errors.append(f"{rel}:{i}: contains \"ECC\" (only {ECC_EXEMPT_SKILL} is exempt)")


def check_broken_references(errors: list[str]) -> None:
    all_ref_files: set[str] = set()
    for skill_dir in SKILLS_DIR.iterdir():
        refs_dir = skill_dir / "references"
        if refs_dir.is_dir():
            for f in refs_dir.glob("*.md"):
                all_ref_files.add(f.name)

    md_files = list(SKILLS_DIR.glob("*/SKILL.md")) + list(SKILLS_DIR.glob("*/references/*.md"))
    for md_file in sorted(md_files):
        rel = md_file.relative_to(REPO_ROOT)
        content = md_file.read_text(encoding="utf-8")
        for i, line in enumerate(content.splitlines(), 1):
            for match in REF_MENTION_RE.finditer(line):
                ref_name = match.group(1)
                if ref_name not in all_ref_files:
                    errors.append(f"{rel}:{i}: references/{ref_name} does not exist anywhere in skills/*/references/")


def main() -> int:
    errors: list[str] = []
    check_frontmatter_and_description(errors)
    check_ecc_mentions(errors)
    check_broken_references(errors)

    if errors:
        print(f"FAILED — {len(errors)} issue(s):\n")
        for e in errors:
            print(f"  - {e}")
        return 1

    skill_count = len(list(SKILLS_DIR.glob("*/SKILL.md")))
    print(f"OK — {skill_count} skills validated, no issues.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
