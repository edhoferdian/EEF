#!/usr/bin/env python3
"""Generate CHANGELOG.md, and one release's notes, from conventional commits.

Every commit here follows `type(scope): subject` (rules/git.md), so the
changelog is derived from git history instead of written by hand: one
section per release tag (v*), commits grouped by type, newest first.
Merge commits and anything not in conventional form are skipped.

Usage:
    python scripts/generate_changelog.py                 # write CHANGELOG.md
    python scripts/generate_changelog.py --check         # exit 1 if CHANGELOG.md is stale
    python scripts/generate_changelog.py --notes         # print notes for commits since the last tag
    python scripts/generate_changelog.py --notes v1.19.0 # print the notes for that tag

Tags must be present locally (`git fetch --tags`).
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CHANGELOG = REPO_ROOT / "CHANGELOG.md"
REPO_URL = "https://github.com/edhoferdian/EEF"

# Section order and titles; types not listed here are left out.
SECTIONS = [
    ("feat", "Features"),
    ("fix", "Fixes"),
    ("perf", "Performance"),
    ("refactor", "Refactoring"),
    ("docs", "Documentation"),
    ("test", "Tests and evals"),
    ("ci", "CI and release"),
    ("chore", "Maintenance"),
]
CONVENTIONAL = re.compile(r"^(?P<type>[a-z]+)(?:\((?P<scope>[^)]+)\))?(?P<breaking>!)?: (?P<subject>.+)$")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=True).stdout


def release_tags() -> list[str]:
    """v* tags, newest first, by version order."""
    return [t for t in git("tag", "--list", "v*", "--sort=-v:refname").split() if t]


def tag_date(tag: str) -> str:
    return git("log", "-1", "--format=%cs", tag).strip()


def commits(rev_range: str) -> list[tuple[str, str]]:
    """(short sha, subject) for non-merge commits in the range, oldest first."""
    out = git("log", "--no-merges", "--reverse", "--format=%h%x09%s", rev_range)
    return [tuple(line.split("\t", 1)) for line in out.splitlines() if "\t" in line]


def section_body(rev_range: str) -> str:
    grouped: dict[str, list[str]] = {t: [] for t, _ in SECTIONS}
    breaking: list[str] = []
    for sha, subject in commits(rev_range):
        m = CONVENTIONAL.match(subject)
        if not m or m["type"] not in grouped:
            continue
        scope = f"**{m['scope']}:** " if m["scope"] else ""
        line = f"- {scope}{m['subject']} ([{sha}]({REPO_URL}/commit/{sha}))"
        grouped[m["type"]].append(line)
        if m["breaking"]:
            breaking.append(line)
    parts = []
    if breaking:
        parts.append("### Breaking changes\n\n" + "\n".join(breaking))
    for t, title in SECTIONS:
        if grouped[t]:
            parts.append(f"### {title}\n\n" + "\n".join(grouped[t]))
    return "\n\n".join(parts) if parts else "_No conventional commits in this range._"


def build_changelog() -> str:
    tags = release_tags()
    out = [
        "# Changelog\n\n"
        "Generated from conventional commits by `scripts/generate_changelog.py` — do not edit by hand.\n"
    ]
    for i, tag in enumerate(tags):
        prev = tags[i + 1] if i + 1 < len(tags) else None
        rng = f"{prev}..{tag}" if prev else tag
        out.append(f"## [{tag}]({REPO_URL}/releases/tag/{tag}) — {tag_date(tag)}\n\n{section_body(rng)}\n")
    return "\n".join(out)


def notes_for(tag: str | None) -> str:
    tags = release_tags()
    if tag is None:
        return section_body(f"{tags[0]}..HEAD" if tags else "HEAD")
    if tag not in tags:
        sys.exit(f"unknown tag {tag!r}")
    i = tags.index(tag)
    return section_body(f"{tags[i + 1]}..{tag}" if i + 1 < len(tags) else tag)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="exit 1 if CHANGELOG.md is stale instead of writing it")
    parser.add_argument("--notes", nargs="?", const="", metavar="TAG",
                        help="print release notes: for TAG, or for commits since the last tag")
    args = parser.parse_args()

    if args.notes is not None:
        print(notes_for(args.notes or None))
        return 0

    content = build_changelog()
    current = CHANGELOG.read_text(encoding="utf-8") if CHANGELOG.exists() else None
    if current == content:
        print("CHANGELOG.md is in sync.")
        return 0
    if args.check:
        print("STALE: CHANGELOG.md\n\nRun: python scripts/generate_changelog.py")
        return 1
    CHANGELOG.write_text(content, encoding="utf-8", newline="\n")
    print(f"Wrote CHANGELOG.md ({len(release_tags())} releases).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
