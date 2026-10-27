#!/usr/bin/env python3
"""Run every generator in this repo, or check that none of them is stale.

The one list of generated artifacts. CI's export-targets-sync job, the
.husky/pre-commit hook and CONTRIBUTING.md all call this script instead
of each keeping its own list of export_*.py scripts — CONTRIBUTING.md once
named 7 of them while 18 existed, which is the drift this file removes.

Usage:
    python scripts/regen_all.py            # rewrite every generated file
    python scripts/regen_all.py --check    # exit 1 if any generated file is stale
    python scripts/regen_all.py --check --skip generate_changelog
                                           # skip a generator (e.g. no tags fetched)

A new generator is added here, once, and nowhere else.
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent

# Write-only steps that create inputs for the generators below; no --check form.
PREPARE = ["generate_agent_stubs"]

# Order matters only where one output feeds another: counts first, then the
# per-harness exports, then the catalog that lists them.
GENERATORS = [
    "sync_metadata",
    "package_skills",
    "export_agents_md",
    "export_gemini_md",
    "export_cursor",
    "export_windsurf",
    "export_cline",
    "export_copilot",
    "export_kiro",
    "export_hermes",
    "export_openclaw",
    "export_zcode",
    "export_agents_claude",
    "export_agents_opencode",
    "export_agents_hermes",
    "export_agents_zcode",
    "export_agents_codex",
    "export_agents_routing",
    "generate_catalog",
    "generate_changelog",  # needs release tags locally (git fetch --tags)
]

CHILD_ENV = {**os.environ, "PYTHONIOENCODING": "utf-8"}  # Windows Python defaults to cp1252 output


def run(script: str, *args: str) -> bool:
    proc = subprocess.run([sys.executable, str(SCRIPTS / f"{script}.py"), *args], env=CHILD_ENV)
    return proc.returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="exit 1 if any generated file is stale instead of writing")
    parser.add_argument("--skip", action="append", default=[], metavar="NAME", help="skip one generator (repeatable)")
    args = parser.parse_args()

    unknown = set(args.skip) - set(GENERATORS) - set(PREPARE)
    if unknown:
        parser.error(f"unknown generator(s): {', '.join(sorted(unknown))}")

    steps = [s for s in GENERATORS if s not in args.skip]
    if not args.check:
        steps = [s for s in PREPARE if s not in args.skip] + steps

    failed = []
    for script in steps:
        print(f"== {script}", flush=True)
        if not run(script, *(["--check"] if args.check and script in GENERATORS else [])):
            failed.append(script)

    if failed:
        print(f"\n{len(failed)} generator(s) failed or are stale: {', '.join(failed)}")
        if args.check:
            print("Run: python scripts/regen_all.py   (then git add the results)")
        return 1
    print(f"\nAll {len(steps)} generator(s) {'in sync' if args.check else 'ran'}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
