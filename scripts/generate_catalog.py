#!/usr/bin/env python3
"""Generate CATALOG.md — a single browsable table of every skill and its
agent counterpart, with a one-line purpose and a longer "use when" cell.

README.md already explains how to install this ecosystem and how the
skill/agent layers relate to each other; it deliberately does not enumerate
every skill (it just points at skills/). This file is the enumeration —
generated from the same frontmatter every other export_*.py script reads,
so it can't drift into hand-written claims a skill's own description
doesn't back up.

Usage:
    python scripts/generate_catalog.py            # write CATALOG.md
    python scripts/generate_catalog.py --check     # exit 1 if stale
"""
import argparse
import sys

from lib_agents import load_agents
from lib_skills import REPO_ROOT, load_skills

DEST = REPO_ROOT / "CATALOG.md"

# Hand-tuned agents whose name doesn't match a skill folder 1:1 (the 9
# split/reused agents documented in README.md's "Agent orchestration"
# section) — mapped here so the table can still point at the skill(s) they
# actually serve, instead of a bare "no matching skill folder". Source of
# truth for this list is README.md's own prose; update this dict if that
# section changes rather than letting the two silently diverge.
AGENT_SKILL_ALIASES: dict[str, list[str]] = {
    "code-reviewer-edho-ferdian": ["code-review-edho-ferdian"],
    "code-critic-edho-ferdian": ["code-review-edho-ferdian", "security-review-edho-ferdian"],
    "gan-generator-edho-ferdian": ["gan-harness-edho-ferdian"],
    "gan-evaluator-edho-ferdian": ["gan-harness-edho-ferdian"],
    "opensource-sanitizer-edho-ferdian": ["opensource-release-edho-ferdian"],
    "research-worker-edho-ferdian": ["research-ops-edho-ferdian"],
    "research-fact-checker-edho-ferdian": ["research-ops-edho-ferdian"],
    "click-path-tracer-edho-ferdian": ["click-path-audit-edho-ferdian"],
    "spec-mining-worker-edho-ferdian": ["spec-mining-edho-ferdian"],
}

HEADER_TEMPLATE = """\
# EEF Skill & Agent Catalog

Generated from every `skills/*/SKILL.md` and `agents/*/AGENT.md`
frontmatter in this repo — run `python scripts/generate_catalog.py` after
adding or editing a skill/agent rather than hand-editing this file, the
same convention every other generated file here follows (see README.md's
"Other harnesses" section).

This lists **what exists and when to reach for it**. For *how installing
and using this ecosystem actually works* (auto-triggering, explicit
invocation, the skill/agent relationship, harness support), see
[README.md](README.md) first — this file is the reference table it points
to, not a replacement for it.

{count} skills, {agent_count} agents.

## Skills

Skills are the primary unit — each one auto-triggers when a request
matches its description (Claude Code, Cursor, Windsurf/Devin) or is read on
demand from the router files (AGENTS.md, GEMINI.md, and the rest — see
README.md). Skill names ending in `-edho-ferdian` are this ecosystem's own
naming convention.

| Skill | Use when | Agent form |
|---|---|---|
"""

AGENTS_HEADER = """

## Agents

An agent is the same skill's criteria wrapped for **delegation** — handing
a task to an isolated context (a sub-agent call, a parallel worker) instead
of running it in the main conversation. Reach for the agent form when a
task is substantial enough to isolate or parallelize; a small task should
just use the skill directly. Most agents here are thin wrappers that defer
entirely to their matching skill's own instructions (so they can't drift
from it); a handful are hand-tuned because a specific phase genuinely needs
independence from another phase's reasoning (adversarial critique,
parallel fan-out) rather than just a scoped-down persona — README.md's
"Agent orchestration" section has the full list and the reasoning for each.

| Agent | Use when | Wraps skill |
|---|---|---|
"""

FOOTER = """

## Regenerating

```bash
python scripts/generate_catalog.py            # rewrite CATALOG.md
python scripts/generate_catalog.py --check     # exit 1 if stale (same convention as the other export_*.py scripts)
```
"""


def truncate(text: str, limit: int = 260) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return f"{cut}…"


def escape(text: str) -> str:
    return text.replace("|", "\\|")


def build_content() -> str:
    skills = load_skills()
    agents = load_agents()
    agent_by_name = {a.name: a for a in agents}

    # Reverse of AGENT_SKILL_ALIASES, so a skill with a differently-named
    # (or additionally reused) agent still shows it in the Skills table.
    extra_agents_by_skill: dict[str, list[str]] = {}
    for agent_name, skill_names in AGENT_SKILL_ALIASES.items():
        for skill_name in skill_names:
            extra_agents_by_skill.setdefault(skill_name, []).append(agent_name)

    header = HEADER_TEMPLATE.format(count=len(skills), agent_count=len(agents))

    skill_rows = []
    for s in skills:
        use_when = escape(truncate(s.description))
        agent_names = []
        if s.name in agent_by_name:
            agent_names.append(s.name)
        agent_names.extend(extra_agents_by_skill.get(s.name, []))
        if agent_names:
            agent_cell = ", ".join(f"[`{name}`](agents/{name}/AGENT.md)" for name in agent_names)
        else:
            agent_cell = "—"
        skill_rows.append(f"| [`{s.name}`](skills/{s.name}/SKILL.md) | {use_when} | {agent_cell} |")

    agent_rows = []
    for a in agents:
        use_when = escape(truncate(a.description))
        skill_dir = REPO_ROOT / "skills" / a.name
        if skill_dir.exists():
            skill_cell = f"[`{a.name}`](skills/{a.name}/SKILL.md)"
        elif a.name in AGENT_SKILL_ALIASES:
            skill_cell = ", ".join(
                f"[`{name}`](skills/{name}/SKILL.md)" for name in AGENT_SKILL_ALIASES[a.name]
            )
        else:
            skill_cell = "— (see README.md's Agent orchestration section)"
        agent_rows.append(f"| [`{a.name}`](agents/{a.name}/AGENT.md) | {use_when} | {skill_cell} |")

    return header + "\n".join(skill_rows) + AGENTS_HEADER + "\n".join(agent_rows) + FOOTER


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if CATALOG.md is stale instead of writing it")
    args = parser.parse_args()

    wanted = build_content()
    current = DEST.read_text(encoding="utf-8", newline=None) if DEST.exists() else None

    if current == wanted:
        print("CATALOG.md is in sync." if args.check else "CATALOG.md already up to date.")
        return 0

    if args.check:
        print("STALE: CATALOG.md does not match skills/agents — run: python scripts/generate_catalog.py")
        return 1

    DEST.write_text(wanted, encoding="utf-8")
    print(f"Wrote CATALOG.md ({len(load_skills())} skills, {len(load_agents())} agents).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
