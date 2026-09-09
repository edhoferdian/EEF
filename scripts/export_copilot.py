#!/usr/bin/env python3
"""Generate .github/copilot-instructions.md — the repository-wide custom
instructions file GitHub Copilot loads automatically, in full, on every
chat/completion request across its surfaces (Copilot Chat in VS Code and
Visual Studio, Copilot in the JetBrains/Xcode/Eclipse IDEs, Copilot CLI,
Copilot code review, and Copilot coding/cloud agent). Confirmed against
GitHub's own docs (docs.github.com/copilot/customizing-copilot/
adding-custom-instructions-for-github-copilot, fetched 2026-09-09): this
file takes **no required frontmatter** — it is plain natural-language
Markdown, always read in full. Same "always-loaded, no partial loading"
constraint as AGENTS.md, so the same router shape applies here: a compact
table of skill name / trigger description / path, not a dump of all 33
skills' full content. See export_agents_md.py for the fuller rationale.

## Why this script does NOT also generate .github/instructions/*.instructions.md

GitHub Copilot has a second, newer mechanism confirmed live and current
(not a preview/rumor) as of the same doc fetch: path-scoped instruction
files at `.github/instructions/<name>.instructions.md`, each with a
required YAML frontmatter `applyTo` field taking one or more comma-
separated glob patterns (e.g. `applyTo: "**/*.ts,**/*.tsx"`), plus
optional `description`/`name` fields for UI display and an optional
`excludeAgent` field. This is structurally closer to Claude Skills /
Cursor's per-file .mdc split than the single router file is.

We deliberately do NOT generate these for EEF, after actually checking
the 32 skills under skills/*/SKILL.md against the mechanism's shape:

1. **Applicability mismatch.** `applyTo` glob-matches file paths being
   edited/viewed. Almost every EEF skill is *workflow*-triggered (a task
   description like "review this PR", "set up billing ops", "audit SEO"),
   not *file-type*-triggered. None of them read naturally as "always
   apply when editing **/*.ts" the way a style-guide or lint-convention
   skill would — even language-adjacent skills here (e.g.
   `language-code-review-edho-ferdian`, `frontend-engineering-edho-ferdian`)
   are reviewer/workflow playbooks spanning many languages and file
   kinds, not single-glob rules. Forcing a glob onto them would either be
   so broad (`**`) that it duplicates the router file, or so narrow that
   it silently stops firing for the majority of real requests.
2. **Narrow current support surface.** GitHub's own docs state
   path-specific custom instructions are, on GitHub.com today, only
   consumed by Copilot cloud agent and Copilot code review — not the
   everyday Copilot Chat/completions surface most EEF users are actually
   in. Investing in a second generated-file mechanism whose primary
   payoff surface is two specific agents (vs. the router file's universal
   reach) is not proportionate to EEF's current workflow-shaped skill
   set.
3. **Consistent with the Cursor adapter's own judgment call.**
   export_cursor.py already left `globs:` empty for the same reason on
   the same skill set (see its docstring) — this script makes the same
   call for the same underlying reason, on Copilot's equivalent field.

If EEF later adds a genuinely file-type-scoped skill (e.g. a Python-only
or Terraform-only convention playbook), add a small, explicit allowlist
here rather than auto-deriving `applyTo` globs from free-text
descriptions — the failure mode of a wrong glob (silently not firing, or
firing on the wrong files) is worse than the failure mode of the router
file (always loaded, slightly more context).

Usage:
    python scripts/export_copilot.py            # write .github/copilot-instructions.md
    python scripts/export_copilot.py --check     # exit 1 if stale
"""
import argparse
import sys

from lib_skills import REPO_ROOT, load_skills

DEST = REPO_ROOT / ".github" / "copilot-instructions.md"

HEADER = """\
# GitHub Copilot Instructions — Ekosistem Edho Ferdian (EEF)

This project ships 33 skills under `skills/*/SKILL.md` — each one a focused
playbook for a specific engineering task (code review, API design, test
authoring, deployment, and more). This file is a router, not a full copy:
skim the table below, and when a request matches a row, **read that skill's
`SKILL.md` file before acting** — it has the actual workflow, checklists,
and reference material this index intentionally leaves out to stay small.

A skill's own `references/*.md` files go one level deeper still; its
`SKILL.md` tells you when to open those too. Don't guess at a skill's
method from its one-line description here — read the file.

## Skills

| Skill | Use when | Path |
|---|---|---|
"""

FOOTER = """

## Notes for Copilot

- These skills were authored for Claude Code's Agent Skills format, but the
  content itself is plain Markdown with no Claude-specific syntax — reading
  a `SKILL.md` file directly works the same way here as it does there.
- This repo does not currently ship path-scoped
  `.github/instructions/*.instructions.md` files. Every skill here is
  workflow-triggered (matched by task description), not file-type-triggered
  (matched by a glob), so the always-loaded router above is the better fit
  — see the module docstring in `scripts/export_copilot.py` for the full
  reasoning, and reconsider only for a genuinely file-type-scoped skill.
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
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit 1 if .github/copilot-instructions.md is stale instead of writing it",
    )
    args = parser.parse_args()

    wanted = build_content()
    current = DEST.read_text(encoding="utf-8", newline=None) if DEST.exists() else None

    if current == wanted:
        print(
            ".github/copilot-instructions.md is in sync."
            if args.check
            else ".github/copilot-instructions.md already up to date."
        )
        return 0

    if args.check:
        print(
            "STALE: .github/copilot-instructions.md does not match skills/ — "
            "run: python scripts/export_copilot.py"
        )
        return 1

    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(wanted, encoding="utf-8")
    print(f"Wrote .github/copilot-instructions.md ({len(load_skills())} skills).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
