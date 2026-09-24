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
5. Agents (D-055) — every agents/*/AGENT.md names its wrapped skill(s) in
   `skills:` and carries the "Loading the wrapped skill" section.
6. No filesystem-wide searches (D-055) — no skill/agent line tells a model
   to search from a drive or home root (`<!-- fs-search-ok -->` exempts a
   line that names the banned form on purpose).
7. No live pointers into the external rules tree (D-034) — historical
   mentions carry `<!-- d034-ok -->`.

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
                errors.append(f"{rel}:{i}: contains \"ECC\" (only {ECC_EXEMPT_SKILLS} is exempt)")


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


AGENTS_DIR = REPO_ROOT / "agents"
AGENT_SKILLS_RE = re.compile(r"^skills:\s*(.+)$", re.MULTILINE)
LOADING_SECTION_HEADING = "## Loading the wrapped skill"
# A skill or agent that tells a model to search from a drive or home root
# spawns scans that run for hours on Windows (2026-09-24: piled-up find.exe
# processes hunting for SKILL.md). Scoped searches (`find . -name`,
# `find src/ ...`) are fine; only root-level sweeps are flagged.
FS_WIDE_SEARCH_RE = re.compile(
    r"find\s+(/|~|\$HOME|C:)(\s|$)|Get-ChildItem\b[^\n]*-Recurse[^\n]*\b[A-Z]:\\?(\s|$)|dir\s+/s\s+[A-Z]:\\?",
    re.IGNORECASE,
)


def check_agents(errors: list[str]) -> None:
    for agent_md in sorted(AGENTS_DIR.glob("*/AGENT.md")):
        rel = agent_md.relative_to(REPO_ROOT)
        content = agent_md.read_text(encoding="utf-8")
        m = FRONTMATTER_RE.search(content)
        if not m:
            errors.append(f"{rel}: no valid --- frontmatter block found")
            continue
        skills_m = AGENT_SKILLS_RE.search(m.group(1))
        if not skills_m:
            errors.append(f"{rel}: missing `skills:` naming the skill(s) this agent wraps")
        else:
            for name in (s.strip() for s in skills_m.group(1).split(",")):
                if not (SKILLS_DIR / name / "SKILL.md").exists():
                    errors.append(f"{rel}: `skills:` names {name}, which has no skills/{name}/SKILL.md")
        if LOADING_SECTION_HEADING not in content:
            errors.append(f"{rel}: missing \"{LOADING_SECTION_HEADING}\" section (see generate_agent_stubs.py)")


def check_filesystem_wide_search(errors: list[str]) -> None:
    files = list(SKILLS_DIR.rglob("*.md")) + list(AGENTS_DIR.glob("*/AGENT.md"))
    for md_file in sorted(files):
        rel = md_file.relative_to(REPO_ROOT)
        in_loading_section = False
        for i, line in enumerate(md_file.read_text(encoding="utf-8").splitlines(), 1):
            # The loading section names these commands to forbid them.
            if line.startswith("## "):
                in_loading_section = line.strip() == LOADING_SECTION_HEADING
            # Elsewhere, a line that names a banned form on purpose carries
            # an explicit `<!-- fs-search-ok -->` marker.
            if in_loading_section or "fs-search-ok" in line:
                continue
            if FS_WIDE_SEARCH_RE.search(line):
                errors.append(f"{rel}:{i}: filesystem-wide search from a drive/home root — scope it to a known directory")


# D-034: a pointer into the globally installed external rules tree is a
# live dependency on the harness this ecosystem is decommissioning (D-005).
# Historical mentions carry an explicit `<!-- d034-ok -->` marker.
EXTERNAL_RULES_RE = re.compile(r"\.claude/rules/ecc\b")


def check_external_rule_pointers(errors: list[str]) -> None:
    for md_file in sorted(SKILLS_DIR.rglob("*.md")):
        rel = md_file.relative_to(REPO_ROOT)
        if rel.parts[1] in ECC_EXEMPT_SKILLS:
            continue
        for i, line in enumerate(md_file.read_text(encoding="utf-8").splitlines(), 1):
            if EXTERNAL_RULES_RE.search(line) and "d034-ok" not in line:
                errors.append(f"{rel}:{i}: live pointer into ~/.claude/rules/ecc (D-034) — restate natively or mark historical")


# D-059: rules/*.md load into every session, so they stay short and only
# point into skills; every pointer must resolve.
RULES_DIR = REPO_ROOT / "rules"
MAX_RULE_BYTES = 2500
SKILL_NAME_RE = re.compile(r"\b([a-z0-9-]+-edho-ferdian)\b")
SKILL_PATH_RE = re.compile(r"\b([a-z0-9-]+-edho-ferdian/[A-Za-z0-9_./-]+\.md)\b")


def check_rules(errors: list[str]) -> None:
    for rule in sorted(RULES_DIR.glob("*.md")):
        rel = rule.relative_to(REPO_ROOT)
        content = rule.read_text(encoding="utf-8")
        if len(content.encode("utf-8")) > MAX_RULE_BYTES:
            errors.append(f"{rel}: {len(content.encode('utf-8'))} bytes, exceeds {MAX_RULE_BYTES} — move detail into a skill")
        for name in set(SKILL_NAME_RE.findall(content)):
            if not (SKILLS_DIR / name / "SKILL.md").exists():
                errors.append(f"{rel}: points at {name}, which has no skills/{name}/SKILL.md")
        for ref in set(SKILL_PATH_RE.findall(content)):
            if not (SKILLS_DIR / ref).exists():
                errors.append(f"{rel}: points at skills/{ref}, which does not exist")
        for i, line in enumerate(content.splitlines(), 1):
            if FS_WIDE_SEARCH_RE.search(line) and "fs-search-ok" not in line:
                errors.append(f"{rel}:{i}: filesystem-wide search from a drive/home root")


def main() -> int:
    errors: list[str] = []
    check_rules(errors)
    check_frontmatter_and_description(errors)
    check_ecc_mentions(errors)
    check_broken_references(errors)
    check_agents(errors)
    check_filesystem_wide_search(errors)
    check_external_rule_pointers(errors)

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
