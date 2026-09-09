#!/usr/bin/env python3
"""Generate GEMINI.md — same router content as AGENTS.md, for Google's
Gemini CLI specifically.

Unlike Cline, Zed, Antigravity, and Adal (all confirmed via their own docs
to read AGENTS.md automatically, so none of them need a dedicated file),
Gemini CLI looks for GEMINI.md by default and does NOT fall back to
AGENTS.md unless a user reconfigures `context.fileName` in their own
settings.json — so this ecosystem ships the file Gemini CLI actually looks
for out of the box, rather than relying on every user to know about that
setting.

This intentionally reuses export_agents_md.py's content-building logic
rather than duplicating it — GEMINI.md and AGENTS.md are meant to stay
byte-identical in content (just a different filename), so there is exactly
one place that decides what the router table says.

Usage:
    python scripts/export_gemini_md.py            # write GEMINI.md
    python scripts/export_gemini_md.py --check     # exit 1 if stale
"""
import argparse
import sys

from export_agents_md import build_content
from lib_skills import REPO_ROOT

DEST = REPO_ROOT / "GEMINI.md"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 if GEMINI.md is stale instead of writing it")
    args = parser.parse_args()

    wanted = build_content().replace(
        "# AGENTS.md — Ekosistem Edho Ferdian (EEF)",
        "# GEMINI.md — Ekosistem Edho Ferdian (EEF)\n\n"
        "Identical in content to this repo's `AGENTS.md` — Gemini CLI looks "
        "for this filename specifically and doesn't fall back to AGENTS.md "
        "by default. See `AGENTS.md` for the canonical version; this file "
        "is generated from it, not authored separately.",
        1,
    )
    current = DEST.read_text(encoding="utf-8", newline=None) if DEST.exists() else None

    if current == wanted:
        print("GEMINI.md is in sync." if args.check else "GEMINI.md already up to date.")
        return 0

    if args.check:
        print("STALE: GEMINI.md does not match AGENTS.md — run: python scripts/export_gemini_md.py")
        return 1

    DEST.write_text(wanted, encoding="utf-8")
    print("Wrote GEMINI.md.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
