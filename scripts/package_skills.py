#!/usr/bin/env python3
"""Package every skills/<name>/ folder into dist/<name>.skill.

Used by both CI (.github/workflows/ci.yml) and local development, so the
output is byte-for-byte identical either way: forward-slash paths (works
when uploaded from any OS), sorted file order, and a fixed timestamp on
every zip entry (so re-running on a different day doesn't change the
archive and make CI's "is dist/ in sync" diff always fail).

Usage:
    python scripts/package_skills.py                 # package all skills
    python scripts/package_skills.py --check          # dry run, exit 1 if
                                                        # dist/ is stale
    python scripts/package_skills.py NAME [NAME ...]  # only these skills
"""
import argparse
import sys
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"
DIST_DIR = REPO_ROOT / "dist"

# Fixed timestamp for every zip entry so output is reproducible regardless
# of when the script runs. ZIP format's minimum representable date is 1980.
FIXED_DATE_TIME = (1980, 1, 1, 0, 0, 0)


TEXT_SUFFIXES = {".md", ".txt", ".json", ".yml", ".yaml"}


def read_normalized(f: Path) -> bytes:
    """Read a file's bytes with line endings normalized to LF.

    Git checkouts on Windows can produce CRLF line endings for text files
    (autocrlf) while Linux/CI checkouts keep LF, which would otherwise make
    the packaged archive non-reproducible across machines even though the
    committed source is identical. Binary-ish files (anything not in
    TEXT_SUFFIXES) are read as-is, unmodified.
    """
    if f.suffix.lower() in TEXT_SUFFIXES:
        # newline=None enables universal-newlines mode: \r\n and \r both
        # become \n on read, regardless of platform or git checkout config.
        text = f.read_text(encoding="utf-8", newline=None)
        return text.encode("utf-8")
    return f.read_bytes()


def build_archive_bytes(skill_dir: Path) -> bytes:
    """Return the exact bytes a .skill archive for skill_dir should contain."""
    import io

    buf = io.BytesIO()
    files = sorted(p for p in skill_dir.rglob("*") if p.is_file())
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            rel_path = f.relative_to(skill_dir).as_posix()
            info = zipfile.ZipInfo(rel_path, date_time=FIXED_DATE_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, read_normalized(f))
    return buf.getvalue()


def package_one(skill_dir: Path, check: bool) -> bool:
    """Return True if the on-disk .skill matches what it should be (or was
    just written to match, when not in check mode)."""
    name = skill_dir.name
    dest = DIST_DIR / f"{name}.skill"
    wanted = build_archive_bytes(skill_dir)

    current = dest.read_bytes() if dest.exists() else None
    if current == wanted:
        return True

    if check:
        print(f"STALE: dist/{name}.skill does not match skills/{name}/")
        return False

    DIST_DIR.mkdir(exist_ok=True)
    dest.write_bytes(wanted)
    print(f"Packaged: {name}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("names", nargs="*", help="specific skill names (default: all)")
    parser.add_argument("--check", action="store_true", help="dry run, exit 1 if any dist/*.skill is stale")
    args = parser.parse_args()

    if args.names:
        skill_dirs = [SKILLS_DIR / n for n in args.names]
        missing = [d for d in skill_dirs if not d.is_dir()]
        if missing:
            print(f"No such skill folder(s): {', '.join(d.name for d in missing)}", file=sys.stderr)
            return 2
    else:
        skill_dirs = sorted(p for p in SKILLS_DIR.iterdir() if p.is_dir())

    ok = True
    for skill_dir in skill_dirs:
        if not package_one(skill_dir, args.check):
            ok = False

    if args.check:
        print("dist/ is in sync with skills/" if ok else "\nRun: python scripts/package_skills.py")
    else:
        print(f"Done. {len(skill_dirs)} skill(s) processed.")

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
