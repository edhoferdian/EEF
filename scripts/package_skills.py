#!/usr/bin/env python3
"""Package every skills/<name>/ folder into dist/<name>.skill.

Used by both CI (.github/workflows/ci.yml) and local development.

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

# Fixed timestamp for every zip entry so the archive doesn't change just
# because it was rebuilt on a different day.
FIXED_DATE_TIME = (1980, 1, 1, 0, 0, 0)

TEXT_SUFFIXES = {".md", ".txt", ".json", ".yml", ".yaml"}


def read_normalized(f: Path) -> bytes:
    """Read a file's bytes with line endings normalized to LF.

    Git checkouts on Windows can produce CRLF line endings for text files
    (autocrlf) while Linux/CI checkouts keep LF, even though the committed
    source is identical. Binary-ish files (anything not in TEXT_SUFFIXES)
    are read as-is, unmodified.
    """
    if f.suffix.lower() in TEXT_SUFFIXES:
        # newline=None enables universal-newlines mode: \r\n and \r both
        # become \n on read, regardless of platform or git checkout config.
        text = f.read_text(encoding="utf-8", newline=None)
        return text.encode("utf-8")
    return f.read_bytes()


def build_manifest(skill_dir: Path) -> dict[str, bytes]:
    """Return {relative_posix_path: normalized_content} for a skill folder.

    This is the thing that actually needs to match between skills/<name>/
    and dist/<name>.skill — NOT the raw compressed zip bytes. Two zip
    libraries (or the same library on different OS/zlib builds) can compress
    byte-identical input into different DEFLATE output, so comparing raw
    archive bytes across machines is not just fragile, it observed a real
    Windows-vs-Ubuntu CI mismatch even after content was confirmed identical.
    Comparing decompressed content is the correct invariant.
    """
    files = sorted(p for p in skill_dir.rglob("*") if p.is_file())
    return {f.relative_to(skill_dir).as_posix(): read_normalized(f) for f in files}


def write_archive(skill_dir: Path, dest: Path) -> None:
    manifest = build_manifest(skill_dir)
    dest.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel_path, content in manifest.items():
            info = zipfile.ZipInfo(rel_path, date_time=FIXED_DATE_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, content)


def read_archive_manifest(dest: Path) -> dict[str, bytes] | None:
    if not dest.exists():
        return None
    try:
        with zipfile.ZipFile(dest, "r") as zf:
            return {name: zf.read(name) for name in zf.namelist()}
    except zipfile.BadZipFile:
        return None


def package_one(skill_dir: Path, check: bool) -> bool:
    """Return True if dist/<name>.skill's CONTENT matches skills/<name>/
    (or was just rewritten to match, when not in check mode). Compares
    decompressed file content, not raw archive bytes — see build_manifest.
    """
    name = skill_dir.name
    dest = DIST_DIR / f"{name}.skill"
    wanted = build_manifest(skill_dir)
    current = read_archive_manifest(dest)

    if current == wanted:
        return True

    if check:
        print(f"STALE: dist/{name}.skill does not match skills/{name}/")
        return False

    write_archive(skill_dir, dest)
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
