#!/usr/bin/env bash
# Install script for Ekosistem Edho Ferdian (EEF) — copies skills/*/ into
# ~/.claude/skills/. Run from a cloned copy of this repo.
#
# Usage:
#   ./install.sh                 # install all 33 skills
#   ./install.sh code-review-edho-ferdian dev-kickoff-edho-ferdian
#                                 # install only the named skills
#   ./install.sh --list          # list installable skill names and exit

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="$SCRIPT_DIR/skills"
TARGET_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

if [ ! -d "$SKILLS_SRC" ]; then
  echo "Error: $SKILLS_SRC not found. Run this script from the repo root." >&2
  exit 1
fi

if [ "${1:-}" = "--list" ]; then
  find "$SKILLS_SRC" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort
  exit 0
fi

mkdir -p "$TARGET_DIR"

if [ "$#" -gt 0 ]; then
  names=("$@")
else
  names=()
  while IFS= read -r name; do
    names+=("$name")
  done < <(find "$SKILLS_SRC" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)
fi

installed=0
for name in "${names[@]}"; do
  src="$SKILLS_SRC/$name"
  if [ ! -d "$src" ]; then
    echo "Skip: no such skill '$name'" >&2
    continue
  fi
  dest="$TARGET_DIR/$name"
  rm -rf "$dest"
  cp -r "$src" "$dest"
  echo "Installed: $name -> $dest"
  installed=$((installed + 1))
done

echo ""
echo "Done. $installed skill(s) installed to $TARGET_DIR"
