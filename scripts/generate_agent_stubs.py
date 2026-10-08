#!/usr/bin/env python3
"""Generate a thin agents/<name>/AGENT.md stub for every skill under
skills/ that doesn't already have one.

Every -edho-ferdian skill gets an agent counterpart — not because every
task needs delegation, but because the decision of "does THIS task need
isolated/parallel execution" is a runtime judgment call (made by whatever
is orchestrating: dev-kickoff, another agent, or the user), not a fixed
architectural split baked into which skills exist in agent form and which
don't. A stub costs almost nothing to maintain (it delegates to the skill
for actual criteria, same as the code-reviewer-edho-ferdian pilot), so
blanket coverage is cheap; the expensive, judgment-heavy part — deciding
when to actually delegate — stays out of this file and in each agent's
own description.

Tool scope: most agents get the full working set (Read, Grep, Glob, Bash,
Write, Edit) since they're authoring/action skills. A small allowlist of
pure review/audit/lens skills gets a read-only set instead (Read, Grep,
Glob, Bash) — matching the code-reviewer-edho-ferdian pilot's own
reasoning: a delegated reviewer that CAN'T write anything is a stronger
isolation guarantee than one that merely shouldn't.

tier:/effort: are always "standard"/"medium" here (D-060) — never a model
name; agents/model-profiles.json maps tiers to each harness's models.
Moving a new agent to "light" or "deep" is a deliberate edit made after
asking "is a wrong answer from it loud or quiet?", not something this
generator should guess per skill.

This script only creates AGENT.md for skills that don't have one yet — it
never overwrites an existing, possibly hand-tuned agent definition. Run it
once per newly-added skill, not on every CI check (there is no --check
mode; a missing agent is not itself a sync failure the way a stale
generated file is).

Usage:
    python scripts/generate_agent_stubs.py
"""
import sys

from lib_skills import SKILLS_DIR, load_skills

AGENTS_DIR = SKILLS_DIR.parent / "agents"

# code-review-edho-ferdian is already covered by the hand-tuned pilot
# agent code-reviewer-edho-ferdian (an actor-noun name predating this
# generator's same-name convention) — skip it here so this script doesn't
# create a second, redundant agent for the same skill under a different name.
SKIP_SKILLS = {"code-review-edho-ferdian"}

READ_ONLY_SKILLS = {
    "code-review-edho-ferdian",
    "security-review-edho-ferdian",
    "language-code-review-edho-ferdian",
    "skill-audit-edho-ferdian",
    "click-path-audit-edho-ferdian",
}

# The pilot used an actor-noun name (code-reviewer-edho-ferdian) distinct
# from its skill (code-review-edho-ferdian). Every new stub instead reuses
# the skill's own name verbatim — deriving a natural actor-noun for all 33
# names mechanically isn't reliable ("backend-engineering" -> "backend
# engineer"? "dead-code-cleanup" -> "dead-code-cleaner"?), and Claude
# Code's skills/ and agents/ are separate registries, so the identical
# name causes no collision.
def agent_name(skill_name: str) -> str:
    return skill_name


PREFIX_TEMPLATE = (
    "Agent form of the {name} skill, same triggers — delegate here when the "
    "task justifies isolated or parallel execution; a small task should use "
    "the skill directly instead. "
)

# The wrapped skill's own description — with its full trigger list — is
# already in context every session, so the agent carries only a one-line
# summary of it. Copying the whole description (as stubs did until
# 2026-10-08) made 33 agents restate ~7k tokens per session that the session
# had just read on the skill (scripts/measure_context.py).
SUMMARY_LIMIT = 200


def summarize(description: str) -> str:
    """The skill description's first sentence, cut at a word boundary to
    SUMMARY_LIMIT characters."""
    text = " ".join(description.split())
    first = text.split(". ", 1)[0].rstrip(".")
    if len(first) > SUMMARY_LIMIT:
        first = first[:SUMMARY_LIMIT].rsplit(" ", 1)[0].rstrip(",;:—- ") + "…"
    return first + "."


def build_description(skill) -> str:
    return PREFIX_TEMPLATE.format(name=skill.name) + summarize(skill.description)


# Every agent carries this section (validate_skills.py enforces it). The
# `skills:` frontmatter names the wrapped skill so harnesses that can
# preload it (Claude Code) do; this prose covers the rest. Without it, an
# agent told only to "load the skill" once ran `find / -name SKILL.md` and
# scanned a whole Windows drive for hours.
LOADING_SECTION = """## Loading the wrapped skill

Your instructions live in the {names} skill{plural}, not in this file. Load
{pronoun} through your harness's own skill mechanism first. If you have to
open a file yourself, it is `<skill-name>/SKILL.md` (with `references/`
beside it) inside the skills directory this ecosystem was installed into —
go there directly. Other skills mentioned as `other-skill/...` are siblings
in that same directory.

**Never locate a skill by searching the filesystem** — no `find /`,
`find ~`, `dir /s`, or `Get-ChildItem -Recurse` over a drive or home
directory. On Windows such a scan runs for hours and leaves orphaned
processes behind. If the file is not where it should be, stop and report
that the skill is not installed instead of hunting for it.

"""


def build_agent_md(skill) -> str:
    tools = "Read, Grep, Glob, Bash" if skill.name in READ_ONLY_SKILLS else "Read, Grep, Glob, Bash, Write, Edit"
    name = agent_name(skill.name)
    description = build_description(skill)

    return f"""---
name: {name}
description: >-
  {description}
tools: {tools}
skills: {skill.name}
tier: standard
effort: medium
---

# {skill.name} (Agent)

You are the agent form of this ecosystem's `{skill.name}` skill. Load and
follow that skill's full instructions — this file is deliberately thin and
holds no criteria of its own, so it can never drift from the skill it
wraps.

{LOADING_SECTION.format(names=f"`{skill.name}`", plural="", pronoun="it")}## Scope as a delegate

- You were handed a specific, scoped task, not an open-ended mandate. Stay
  inside the boundary the delegation gave you.
- Report your result back to whatever delegated to you in the format the
  wrapped skill itself defines. Decisions about what happens next with
  your result belong to the caller, not to you.
- This file does not itself decide whether a task is "light enough to stay
  a skill" or "heavy enough to delegate here" — that judgment is made by
  whatever is orchestrating (a skill like dev-kickoff-edho-ferdian, another
  agent, or the user) at the point of delegation.
"""


def main() -> int:
    AGENTS_DIR.mkdir(exist_ok=True)
    created = 0
    skipped = 0

    for skill in load_skills():
        if skill.name in SKIP_SKILLS:
            continue
        dest = AGENTS_DIR / agent_name(skill.name) / "AGENT.md"
        if dest.exists():
            print(f"Skip (already exists): {dest.relative_to(AGENTS_DIR.parent)}")
            skipped += 1
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(build_agent_md(skill), encoding="utf-8", newline="\n")
        print(f"Created: {dest.relative_to(AGENTS_DIR.parent)}")
        created += 1

    print(f"\nDone. {created} agent stub(s) created, {skipped} already existed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
