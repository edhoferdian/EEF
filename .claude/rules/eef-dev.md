# Working on the EEF repo itself

- Source of truth is `skills/`, `agents/`, `rules/`. Everything else
  (`dist/`, `.cursor/`, `.kiro/`, `.hermes/`, `.agents/`, `.zcode/`,
  `AGENTS.md`, `GEMINI.md`, `CATALOG.md`, `CHANGELOG.md`) is generated:
  edit the source, then `python scripts/regen_all.py`.
- Before a PR: `python scripts/validate_skills.py`,
  `python scripts/regen_all.py --check`,
  `python -m unittest discover -s tests -p "test_*.py"`,
  `node --test tests/*.test.js`.
- A skill description stays under 450 characters (CI enforces it).
- Land work through a PR to `main`; never rename the CI jobs `main`'s
  ruleset requires. Benchmark records under `evals/*/results*/runs/` are
  append-only.
- `project-memory/` (decision register D-0xx, progress, instincts) is
  private and gitignored. When present, read
  `project-memory/01-decision-register.md` before acting on a D-0xx
  decision.
