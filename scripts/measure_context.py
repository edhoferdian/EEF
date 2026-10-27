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

Skill descriptions have a second, harder limit. Claude Code caps the whole
skill listing at a share of the context window (skillListingBudgetFraction,
1% by default) and, when it overflows, drops the descriptions of the
least-used skills: they stay listed by name only and lose the trigger
phrases that make them fire. On 2026-10-27 that had stripped 14 of 38 EEF
skills. EEF shares that listing with every other skill a user has, so its
own share must stay well under it: --max-desc-chars caps any one
description and --listing-chars caps all of them together.

Usage:
    python scripts/measure_context.py               # report
    python scripts/measure_context.py --top 15      # longer ranking
    python scripts/measure_context.py --budget 20000  # exit 1 above this many est. tokens
    python scripts/measure_context.py --max-desc-chars 450 --listing-chars 14000
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
    parser.add_argument("--max-desc-chars", type=int, help="fail when any skill description is longer than this")
    parser.add_argument("--listing-chars", type=int,
                        help="fail when all skill names plus descriptions exceed this many chars")
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
    failed = False
    if args.budget is not None and est_tokens(total) > args.budget:
        print(f"OVER BUDGET: ~{est_tokens(total):,} > {args.budget:,} tokens")
        failed = True

    listing = sum(len(s.name) + len(s.description) for s in skills)
    print(f"skill listing share (names + descriptions): {listing:,} chars, ~{est_tokens(listing):,} tokens")
    if args.listing_chars is not None and listing > args.listing_chars:
        print(f"OVER LISTING BUDGET: {listing:,} > {args.listing_chars:,} chars — shorten descriptions, "
              "or Claude Code drops some of them")
        failed = True
    if args.max_desc_chars is not None:
        for s in skills:
            if len(s.description) > args.max_desc_chars:
                print(f"DESCRIPTION TOO LONG: {s.name} has {len(s.description)} > {args.max_desc_chars} chars")
                failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
