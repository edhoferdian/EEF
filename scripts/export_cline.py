#!/usr/bin/env python3
"""Generate .clinerules/00-ecosystem-router.md for Cline (github.com/cline/cline),
one of the largest open-source VS Code coding agents.

Schema confirmed 2026-09-09 directly against Cline's own docs source
(raw.githubusercontent.com/cline/cline/main/docs/customization/cline-rules.mdx
— not blog-post summaries, which disagreed with each other and with the
docs). Findings that shape this adapter's design:

1. Directory: `.clinerules/` (a folder of .md/.txt files) is Cline's own
   documented "Primary rule format" — NOT `.cline/rules/`. Several
   third-party blog posts claim `.cline/rules/` is now preferred; the
   official docs page contains no such path anywhere. That claim does not
   check out and this adapter does not use it.

2. Frontmatter schema for "Conditional Rules": a `paths:` key (not
   `globs:`) holding a YAML list of glob patterns. This is FILE-PATH
   scoping, not task-relevance scoping — a rule activates when a glob
   matches a file in current context (open tabs, visible files, paths
   mentioned in the user's message, files Cline just edited or is about
   to edit). There is no description-based "apply intelligently" matching
   like Cursor's .mdc `description` field or a Claude Skill's frontmatter
   description — Cline has no semantic auto-triggering at all.
   Consequently: "Without conditionals, every rule loads for every
   request" (docs, verbatim) — a rule file with no frontmatter, once
   toggled on in the Rules panel, is unconditionally injected into every
   single prompt regardless of relevance.

3. Design decision — ROUTER, not one file per skill: this ecosystem's 33
   skills are workflow playbooks (code-review, api-design, deployment-ops,
   ...), not file-type or directory-scoped style guides. `paths:` globs
   have no natural mapping onto "only load when the task is about API
   design" the way a Claude Skill's description does — faking it with globs
   (e.g. matching `**/*.py` to a "python-review" skill) would both
   under- and over-fire relative to actual task intent. Since there's no
   relevance mechanism to hang 33 separate always-on files off of, shipping
   33 unconditional .clinerules/*.md files would mean every one of their
   full bodies gets reinjected into every request forever — the exact
   failure mode this research was sent to check for. So this adapter
   mirrors export_agents_md.py's router pattern instead: one small
   always-on file (no frontmatter — deliberately, since path-scoping
   doesn't fit workflow skills) that tells Cline to go read the matching
   skills/<name>/SKILL.md on demand, reproducing cheap-metadata /
   full-content-on-demand loading without a mechanism Cline doesn't have.

4. Cline already reads AGENTS.md automatically — both a workspace
   `AGENTS.md` and a global `~/.agents/AGENTS.md` are in its own
   documented "Supported Rule Types" table, verbatim: "AGENTS.md |
   AGENTS.md, ~/.agents/AGENTS.md | Standard format for cross-tool
   compatibility." That means export_agents_md.py's output is *already*
   picked up by Cline with zero extra work — this adapter is a defensive
   duplicate, not a strict requirement. It earns its place for two small
   reasons: (a) it shows up in Cline's Rules panel as a distinctly-Cline
   entry the user can see and individually toggle, which AGENTS.md's
   auto-detected entry also does, so this is mostly belt-and-suspenders;
   (b) it protects against the (undocumented, unverified) possibility of
   AGENTS.md detection being workspace-config-gated in some Cline builds.
   If this repo ever wants to cut generated files, this is the first
   adapter to drop — AGENTS.md alone likely already covers Cline.

Usage:
    python scripts/export_cline.py            # write .clinerules/00-ecosystem-router.md
    python scripts/export_cline.py --check     # exit 1 if stale
"""
import argparse
import sys

from lib_skills import REPO_ROOT, load_skills

DEST_DIR = REPO_ROOT / ".clinerules"
DEST = DEST_DIR / "00-ecosystem-router.md"

HEADER = """\
# Ekosistem Edho Ferdian — skill router (Cline)

This project ships 33 skills under `skills/*/SKILL.md` — each one a focused
playbook for a specific engineering task (code review, API design, test
authoring, deployment, and more).

Cline has no relevance-based auto-loading for rule files (its only
conditional mechanism, `paths:` frontmatter, matches file-path globs, not
task intent) — so this file is deliberately a router, not a dump of all 33
skills' full content, which would otherwise get reinjected into every single
request regardless of relevance. Skim the table below, and when a request
matches a row, **read that skill's `SKILL.md` file before acting** — it has
the actual workflow, checklists, and reference material this index
intentionally leaves out to stay small.

A skill's own `references/*.md` files go one level deeper still; its
`SKILL.md` tells you when to open those too. Don't guess at a skill's method
from its one-line description here — read the file.

Note: this repo also generates `AGENTS.md` at the project root, which Cline
reads automatically (see Cline's own docs — Supported Rule Types). This file
duplicates that router only so it also appears in Cline's Rules panel as a
distinctly-Cline, individually-toggleable entry.

## Skills

| Skill | Use when | Path |
|---|---|---|
"""

FOOTER = """
"""


def truncate(text: str, limit: int = 140) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return f"{cut}…"


def build_content() -> str:
    skills = load_skills()
    rows = []
    for s in skills:
        one_line = truncate(s.description)
        # Escape pipe characters so they don't break the Markdown table.
        one_line = one_line.replace("|", "\\|")
        rows.append(f"| `{s.name}` | {one_line} | `skills/{s.name}/SKILL.md` |")
    return HEADER + "\n".join(rows) + FOOTER


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if the router file is stale instead of writing it")
    args = parser.parse_args()

    wanted = build_content()
    current = DEST.read_text(encoding="utf-8", newline=None) if DEST.exists() else None

    if current == wanted:
        print(".clinerules/00-ecosystem-router.md is in sync." if args.check else "Already up to date.")
        return 0

    if args.check:
        print(f"STALE: {DEST.relative_to(REPO_ROOT)} — run: python scripts/export_cline.py")
        return 1

    DEST_DIR.mkdir(parents=True, exist_ok=True)
    DEST.write_text(wanted, encoding="utf-8")
    print(f"Wrote: {DEST.relative_to(REPO_ROOT)} ({len(load_skills())} skills).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
