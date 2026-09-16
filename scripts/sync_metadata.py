#!/usr/bin/env python3
"""Keep the skill/agent COUNT in sync everywhere it's mentioned in prose or
generated-file templates that don't already compute it live.

This exists because of a real, repeated bug class found 2026-09-16: three
export_*.py scripts, package.json's description, bin/eef.js's --help text,
and both .claude-plugin manifests all had the skill count hard-coded as a
literal number that drifted the moment a skill was added or removed —
some as stale as "33" while the repo was already at 35. Rather than fix
this once more by hand, this script is the single place that knows the
live count and rewrites every other file that quotes it.

Usage:
    python scripts/sync_metadata.py            # rewrite every target file
    python scripts/sync_metadata.py --check     # exit 1 if any target is stale
"""
import argparse
import re
import sys

from lib_agents import load_agents
from lib_skills import REPO_ROOT, load_skills

PACKAGE_JSON = REPO_ROOT / "package.json"
EEF_JS = REPO_ROOT / "bin" / "eef.js"
PLUGIN_JSON = REPO_ROOT / ".claude-plugin" / "plugin.json"
MARKETPLACE_JSON = REPO_ROOT / ".claude-plugin" / "marketplace.json"

# Each entry: (file, compiled regex with one capture group around the
# number to replace, format string for the replacement number).
# The regex must match the exact phrasing already in each file so a
# rewrite is a pure substitution, never a rewording.
TARGETS = [
    (
        PACKAGE_JSON,
        re.compile(r"Ekosistem Edho Ferdian's (\d+) skills and (\d+) sub-agents"),
        lambda skills, agents: f"Ekosistem Edho Ferdian's {skills} skills and {agents} sub-agents",
    ),
    (
        EEF_JS,
        re.compile(r"Install all (\d+) skills for Claude Code"),
        lambda skills, agents: f"Install all {skills} skills for Claude Code",
    ),
    (
        PLUGIN_JSON,
        re.compile(r"skill ecosystem — (\d+) skills covering"),
        lambda skills, agents: f"skill ecosystem — {skills} skills covering",
    ),
    (
        MARKETPLACE_JSON,
        re.compile(r"(\d+) native skills for engineering"),
        lambda skills, agents: f"{skills} native skills for engineering",
    ),
]


def rewrite(path, pattern, make_replacement, skills_count, agents_count):
    text = path.read_text(encoding="utf-8")
    match = pattern.search(text)
    if not match:
        raise ValueError(
            f"{path.relative_to(REPO_ROOT)}: expected phrase not found — the wording "
            "changed and this script's regex needs updating to match it"
        )
    replacement = make_replacement(skills_count, agents_count)
    new_text = text[: match.start()] + replacement + text[match.end() :]
    return new_text, new_text != text


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if any target file is stale instead of writing it")
    args = parser.parse_args()

    skills_count = len(load_skills())
    agents_count = len(load_agents())

    stale = []
    for path, pattern, make_replacement in TARGETS:
        new_text, changed = rewrite(path, pattern, make_replacement, skills_count, agents_count)
        if changed:
            stale.append((path, new_text))

    if not stale:
        print("All metadata counts are in sync." if args.check else "Already up to date.")
        return 0

    if args.check:
        for path, _ in stale:
            print(f"STALE: {path.relative_to(REPO_ROOT)} does not match the live skill/agent count — run: python scripts/sync_metadata.py")
        return 1

    for path, new_text in stale:
        path.write_text(new_text, encoding="utf-8")
        print(f"Updated {path.relative_to(REPO_ROOT)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
