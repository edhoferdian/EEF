"""Shared helper for reading agents/*/AGENT.md frontmatter, used by every
export_agents_*.py target-adapter script. Mirrors lib_skills.py's parsing
approach so both layers (skills/ and agents/) stay consistent.
"""
import re
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
AGENTS_DIR = REPO_ROOT / "agents"

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
DESC_BLOCK_RE = re.compile(r"^description:\s*>-\n((?:  .+\n?)+)", re.MULTILINE)
DESC_INLINE_RE = re.compile(r"^description:\s*(.+)$", re.MULTILINE)
NAME_RE = re.compile(r"^name:\s*(.+)$", re.MULTILINE)
TOOLS_RE = re.compile(r"^tools:\s*(.+)$", re.MULTILINE)
MODEL_RE = re.compile(r"^model:\s*(.+)$", re.MULTILINE)
SKILLS_RE = re.compile(r"^skills:\s*(.+)$", re.MULTILINE)


@dataclass(frozen=True)
class Agent:
    name: str
    description: str
    tools: str  # comma-separated, as written in frontmatter
    model: str
    body: str  # markdown body after the frontmatter (the system prompt)
    dir: Path  # agents/<name>/
    # The -edho-ferdian skill(s) this agent wraps, from the comma-separated
    # `skills:` frontmatter field. Harness exporters that support preloading
    # (Claude Code) emit it so the agent never has to go looking for them.
    skills: tuple[str, ...] = ()

    @property
    def agent_md(self) -> Path:
        return self.dir / "AGENT.md"


def _parse_agent_md(agent_md: Path) -> Agent:
    content = agent_md.read_text(encoding="utf-8", newline=None)
    m = FRONTMATTER_RE.search(content)
    if not m:
        raise ValueError(f"{agent_md}: no valid frontmatter")
    fm = m.group(1)
    body = content[m.end():].strip("\n")

    name_m = NAME_RE.search(fm)
    name = name_m.group(1).strip() if name_m else agent_md.parent.name

    desc_m = DESC_BLOCK_RE.search(fm)
    if desc_m:
        description = " ".join(line.strip() for line in desc_m.group(1).splitlines())
    else:
        inline_m = DESC_INLINE_RE.search(fm)
        description = inline_m.group(1).strip() if inline_m else ""

    tools_m = TOOLS_RE.search(fm)
    tools = tools_m.group(1).strip() if tools_m else ""

    model_m = MODEL_RE.search(fm)
    model = model_m.group(1).strip() if model_m else ""

    skills_m = SKILLS_RE.search(fm)
    skills = tuple(s.strip() for s in skills_m.group(1).split(",") if s.strip()) if skills_m else ()

    return Agent(
        name=name, description=description, tools=tools, model=model, body=body, dir=agent_md.parent, skills=skills
    )


def load_agents() -> list[Agent]:
    """Return every agent under agents/, sorted by name."""
    return sorted(
        (_parse_agent_md(p) for p in AGENTS_DIR.glob("*/AGENT.md")),
        key=lambda a: a.name,
    )
