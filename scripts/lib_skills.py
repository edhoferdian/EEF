"""Shared helper for reading skill frontmatter, used by every export_*.py
target-adapter script (see scripts/export_agents_md.py, export_cursor.py,
etc.) so each adapter doesn't re-implement frontmatter parsing.
"""
import re
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
DESC_BLOCK_RE = re.compile(r"^description:\s*>-\n((?:  .+\n?)+)", re.MULTILINE)
DESC_INLINE_RE = re.compile(r"^description:\s*(.+)$", re.MULTILINE)
NAME_RE = re.compile(r"^name:\s*(.+)$", re.MULTILINE)


@dataclass(frozen=True)
class Skill:
    name: str
    description: str
    dir: Path  # skills/<name>/

    @property
    def skill_md(self) -> Path:
        return self.dir / "SKILL.md"


def _parse_skill_md(skill_md: Path) -> Skill:
    content = skill_md.read_text(encoding="utf-8", newline=None)
    m = FRONTMATTER_RE.search(content)
    if not m:
        raise ValueError(f"{skill_md}: no valid frontmatter")
    fm = m.group(1)

    name_m = NAME_RE.search(fm)
    name = name_m.group(1).strip() if name_m else skill_md.parent.name

    desc_m = DESC_BLOCK_RE.search(fm)
    if desc_m:
        description = " ".join(line.strip() for line in desc_m.group(1).splitlines())
    else:
        inline_m = DESC_INLINE_RE.search(fm)
        description = inline_m.group(1).strip() if inline_m else ""

    return Skill(name=name, description=description, dir=skill_md.parent)


def load_skills() -> list[Skill]:
    """Return every skill under skills/, sorted by name."""
    return sorted(
        (_parse_skill_md(p) for p in SKILLS_DIR.glob("*/SKILL.md")),
        key=lambda s: s.name,
    )
