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

model: is always "sonnet" here (Claude Code-only field — every other
harness's generator already omits it, see export_agents_opencode.py /
export_agents_zcode.py / export_agents_hermes.py). Matches the pilot;
bumping a specific agent to "opus" later is a deliberate one-line edit,
not something this generator should guess per skill.

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


# Harness description-length ceiling this ecosystem already enforces for
# skills (see skill-authoring-edho-ferdian) — several skill descriptions
# already sit close to it on their own, so the boilerplate prefix below is
# kept minimal and the copied description is truncated rather than left to
# silently blow past the limit.
DESC_LIMIT = 1024
PREFIX_TEMPLATE = (
    "Agent form of the {name} skill, same triggers — delegate here when the "
    "task justifies isolated or parallel execution; a small task should use "
    "the skill directly instead. "
)


TRUNCATION_SUFFIX = "… (see the skill for the full trigger list)"


def build_description(skill) -> str:
    prefix = PREFIX_TEMPLATE.format(name=skill.name)
    body = skill.description
    if len(prefix) + len(body) > DESC_LIMIT:
        budget = DESC_LIMIT - len(prefix) - len(TRUNCATION_SUFFIX)
        if budget <= 0:
            # The prefix (or a future longer skill name) alone already
            # exceeds the limit — no room for any body text at all. Not
            # reachable by any of the 33 skills today, but truncating to a
            # negative slice or calling .rsplit on an empty string would
            # otherwise fail confusingly here instead of with a clear error.
            raise ValueError(
                f"{skill.name}: prefix + truncation suffix alone exceed "
                f"DESC_LIMIT ({DESC_LIMIT}); shorten PREFIX_TEMPLATE or "
                f"raise DESC_LIMIT before adding a name this long."
            )
        truncated = body[:budget].rsplit(" ", 1)[0]
        body = (truncated or body[:budget]) + TRUNCATION_SUFFIX
    return prefix + body


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
model: sonnet
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
        dest.write_text(build_agent_md(skill), encoding="utf-8")
        print(f"Created: {dest.relative_to(AGENTS_DIR.parent)}")
        created += 1

    print(f"\nDone. {created} agent stub(s) created, {skipped} already existed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
