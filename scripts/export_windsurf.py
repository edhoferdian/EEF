#!/usr/bin/env python3
"""Generate .windsurf/rules/*.md — one file per skill, Windsurf's (Cascade's)
own multi-file workspace-rules format.

Schema confirmed directly against Windsurf/Devin's live docs (docs.windsurf.com
now 307-redirects to docs.devin.ai/desktop/cascade/memories — Cognition
acquired Windsurf and has merged the two products' rules system; see "Devin
compatibility" below):

- Each rule file's frontmatter declares an activation mode via a `trigger`
  field. Confirmed valid values (lowercase, snake_case): `always_on`,
  `manual`, `model_decision`, `glob`.
- For Claude-Skill-style "only load when actually relevant" behavior, the
  correct mode is `model_decision` — Cascade reads the file's `description`
  field first and only pulls in the full rule body when it judges the body
  relevant to the current task, the same two-tier semantics as a Claude
  Skill's frontmatter description. This is the mode this adapter uses for
  every skill.
- `description` is a plain YAML string field, read by Cascade specifically
  to decide relevance under `model_decision` — this is the load-bearing
  field this adapter relies on, mirroring `skill.description` exactly the
  way export_cursor.py does for Cursor's `description` field.
- `globs` only applies under `trigger: glob` and is omitted here, since
  these are workflow skills, not file-type-triggered style rules (same
  reasoning as export_cursor.py's `globs:` being left empty).

Character limit: workspace rule files (`.windsurf/rules/*.md`) are capped at
**12,000 characters per file** (confirmed verbatim from docs.devin.ai: "Limited
to 12,000 characters per file" for workspace rules; global rules have a
separate, smaller 6,000-character cap that doesn't apply here since these are
per-skill workspace rules, not the single global_rules.md).

Six of this ecosystem's 33 SKILL.md bodies exceed that cap on their own
(language-code-review, code-review, dev-kickoff, build-fix, security-review,
skill-authoring — all north of 14.5k characters even before frontmatter is
added). Rather than silently emit a file Windsurf will truncate
unpredictably (or reject), this adapter truncates the body itself to fit the
budget and appends an explicit pointer back to the full
`skills/<name>/SKILL.md` so Cascade (and the human reading the file) knows
content was cut and where to find the rest. This is a known, documented
limitation, not a silent one.

Devin compatibility: `.devin/rules/*.md` uses an *identical* frontmatter
schema to `.windsurf/rules/*.md` (same `trigger`/`description`/`globs`
fields, same values, same 12,000-char workspace cap) — confirmed on the same
docs.devin.ai page. Cognition's current builds look in `.devin/rules/` first
and fall back to `.windsurf/rules/`. Since the two formats are byte-for-byte
compatible, this script writes the SAME generated content to BOTH
`.windsurf/rules/<skill>.md` and `.devin/rules/<skill>.md` rather than
building a second adapter — one generator, two harnesses covered.

Usage:
    python scripts/export_windsurf.py            # write all rule files
    python scripts/export_windsurf.py --check     # exit 1 if stale
"""
import argparse
import sys

from lib_skills import FRONTMATTER_RE, REPO_ROOT, Skill, load_skills

WINDSURF_DIR = REPO_ROOT / ".windsurf" / "rules"
DEVIN_DIR = REPO_ROOT / ".devin" / "rules"
DEST_DIRS = (WINDSURF_DIR, DEVIN_DIR)

CHAR_LIMIT = 12_000
TRUNCATION_NOTE_TEMPLATE = (
    "\n\n> **Truncated for Windsurf's {limit:,}-character workspace rule "
    "limit.** Read the full skill at `skills/{name}/SKILL.md` for complete "
    "instructions.\n"
)


def _frontmatter(skill: Skill) -> str:
    desc_escaped = skill.description.replace('"', '\\"')
    return (
        "---\n"
        "trigger: model_decision\n"
        f'description: "{desc_escaped}"\n'
        "---\n"
    )


def rule_content(skill: Skill) -> str:
    raw = skill.skill_md.read_text(encoding="utf-8", newline=None)
    m = FRONTMATTER_RE.search(raw)
    body = raw[m.end():] if m else raw

    frontmatter = _frontmatter(skill)
    content = frontmatter + body

    if len(content) <= CHAR_LIMIT:
        return content

    note = TRUNCATION_NOTE_TEMPLATE.format(limit=CHAR_LIMIT, name=skill.name)
    budget = CHAR_LIMIT - len(frontmatter) - len(note)
    truncated_body = body[:budget]
    # Cut at the last full line so we don't leave a chopped-mid-word tail.
    truncated_body = truncated_body.rsplit("\n", 1)[0]
    return frontmatter + truncated_body + note


def target_paths(skill: Skill) -> tuple:
    return tuple(d / f"{skill.name}.md" for d in DEST_DIRS)


def build_all() -> dict:
    wanted = {}
    for s in load_skills():
        content = rule_content(s)
        for dest in target_paths(s):
            wanted[dest] = content
    return wanted


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if any rule file is stale instead of writing them")
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

    # Remove any leftover rule file for a skill that no longer exists.
    wanted_names = {p.name for p in wanted}
    for dest_dir in DEST_DIRS:
        if not dest_dir.is_dir():
            continue
        for existing in dest_dir.glob("*.md"):
            if existing.name not in wanted_names:
                if args.check:
                    print(f"STALE (orphaned): {existing.relative_to(REPO_ROOT)}")
                    ok = False
                else:
                    existing.unlink()
                    print(f"Removed orphaned: {existing.relative_to(REPO_ROOT)}")

    if args.check:
        print(".windsurf/rules/ and .devin/rules/ are in sync." if ok else "\nRun: python scripts/export_windsurf.py")
    else:
        print(f"Done. {len(wanted)} rule file(s) processed.")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
