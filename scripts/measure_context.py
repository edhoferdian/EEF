#!/usr/bin/env python3
"""Measure what EEF costs every session before any work starts.

Claude Code puts every installed skill's description and every installed
agent's description into context on each session, and loads every file in
~/.claude/rules/eef/ in full. This script sizes those three layers from the
repo (the source of what gets installed), ranks the biggest items, and flags
agent descriptions that mostly repeat the description of the skill they
wrap — text the session then reads twice.

Token counts are estimates (characters / 4); exact counts need the
token-counting API, and the ranking does not change with the divisor.

Usage:
    python scripts/measure_context.py               # report
    python scripts/measure_context.py --top 15      # longer ranking
    python scripts/measure_context.py --budget 20000  # exit 1 above this many est. tokens
"""
import argparse
import sys

from lib_agents import REPO_ROOT, load_agents
from lib_skills import load_skills

CHARS_PER_TOKEN = 4
RULES_DIR = REPO_ROOT / "rules"
# An agent description counts as repeating its skill when this much of the
# skill's description *after its first sentence* appears in it verbatim.
# Agent stubs quote that first sentence on purpose, as a one-line summary
# (generate_agent_stubs.summarize); copying past it is the duplication.
REPEAT_PROBE_CHARS = 120


def est_tokens(chars: int) -> int:
    return round(chars / CHARS_PER_TOKEN)


def repeats_skill(agent_desc: str, skill_desc: str) -> bool:
    rest = " ".join(skill_desc.split()).split(". ", 1)
    probe = rest[1][:REPEAT_PROBE_CHARS] if len(rest) == 2 else ""
    return bool(probe) and probe in " ".join(agent_desc.split())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--top", type=int, default=8, help="items to list per layer")
    parser.add_argument("--budget", type=int, help="fail when the estimated total exceeds this many tokens")
    args = parser.parse_args()

    skills = load_skills()
    agents = load_agents()
    skill_desc = {s.name: s.description for s in skills}
    rules = sorted(RULES_DIR.glob("*.md"))

    layers = {
        "skill descriptions": sorted(((len(s.description), s.name) for s in skills), reverse=True),
        "agent descriptions": sorted(((len(a.description), a.name) for a in agents), reverse=True),
        "rules (always-on, full text)": sorted(
            ((len(r.read_text(encoding="utf-8")), r.name) for r in rules), reverse=True
        ),
    }
    total = 0
    for layer, items in layers.items():
        chars = sum(c for c, _ in items)
        total += chars
        print(f"\n{layer}: {len(items)} items, {chars:,} chars, ~{est_tokens(chars):,} tokens")
        for c, name in items[: args.top]:
            print(f"  {c:>5} chars  ~{est_tokens(c):>4} tok  {name}")

    repeating = [a for a in agents if any(repeats_skill(a.description, skill_desc.get(s, "")) for s in a.skills)]
    dup_chars = sum(len(a.description) for a in repeating)
    print(f"\nagent descriptions that repeat their wrapped skill's description: {len(repeating)}/{len(agents)}, "
          f"{dup_chars:,} chars, ~{est_tokens(dup_chars):,} tokens read twice per session")

    print(f"\nTOTAL loaded every session: {total:,} chars, ~{est_tokens(total):,} tokens (estimate)")
    if args.budget is not None and est_tokens(total) > args.budget:
        print(f"OVER BUDGET: ~{est_tokens(total):,} > {args.budget:,} tokens")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
