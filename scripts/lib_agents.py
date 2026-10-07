"""Shared helper for reading agents/*/AGENT.md frontmatter, used by every
export_agents_*.py target-adapter script. Mirrors lib_skills.py's parsing
approach so both layers (skills/ and agents/) stay consistent.
"""
import json
import re
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
AGENTS_DIR = REPO_ROOT / "agents"
PROFILES_PATH = AGENTS_DIR / "model-profiles.json"

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
DESC_BLOCK_RE = re.compile(r"^description:\s*>-\n((?:  .+\n?)+)", re.MULTILINE)
DESC_INLINE_RE = re.compile(r"^description:\s*(.+)$", re.MULTILINE)
NAME_RE = re.compile(r"^name:\s*(.+)$", re.MULTILINE)
TOOLS_RE = re.compile(r"^tools:\s*(.+)$", re.MULTILINE)
TIER_RE = re.compile(r"^tier:\s*(.+)$", re.MULTILINE)
EFFORT_RE = re.compile(r"^effort:\s*(.+)$", re.MULTILINE)
SKILLS_RE = re.compile(r"^skills:\s*(.+)$", re.MULTILINE)


@dataclass(frozen=True)
class Agent:
    name: str
    description: str
    tools: str  # comma-separated, as written in frontmatter
    # Harness-neutral routing (D-060): `tier` is light|standard|deep and
    # `effort` is low|medium|high|xhigh. Never a model name — resolve_model()
    # turns the pair into one per harness via agents/model-profiles.json.
    tier: str
    effort: str
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

    tier_m = TIER_RE.search(fm)
    tier = tier_m.group(1).strip() if tier_m else ""

    effort_m = EFFORT_RE.search(fm)
    effort = effort_m.group(1).strip() if effort_m else ""

    skills_m = SKILLS_RE.search(fm)
    skills = tuple(s.strip() for s in skills_m.group(1).split(",") if s.strip()) if skills_m else ()

    return Agent(
        name=name,
        description=description,
        tools=tools,
        tier=tier,
        effort=effort,
        body=body,
        dir=agent_md.parent,
        skills=skills,
    )


def load_agents() -> list[Agent]:
    """Return every agent under agents/, sorted by name."""
    return sorted(
        (_parse_agent_md(p) for p in AGENTS_DIR.glob("*/AGENT.md")),
        key=lambda a: a.name,
    )


def load_profiles() -> dict:
    """Return agents/model-profiles.json, the tier -> model mapping (D-060)."""
    return json.loads(PROFILES_PATH.read_text(encoding="utf-8"))


def resolve_model(agent: Agent, harness: str, profiles: dict, profile: str | None = None) -> tuple[str, str | None]:
    """Return (model, effort) for one agent on one harness under a profile.

    effort is the agent's own effort moved by the profile's effort_shift,
    clamped to the ladder and to the model's own ceiling; None when the
    model takes no effort setting (the exporter then omits the field).
    """
    entry = profiles["profiles"][profile or profiles["default_profile"]][agent.tier]
    model = entry[harness]
    levels = profiles["effort_levels"]
    limits = profiles["model_limits"].get(harness, {})
    if model in limits and limits[model] is None:
        return model, None
    ceiling = levels.index(limits[model]) if model in limits else len(levels) - 1
    shifted = levels.index(agent.effort) + entry["effort_shift"]
    return model, levels[max(0, min(shifted, ceiling))]
