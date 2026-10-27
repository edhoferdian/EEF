# EEF Salak rule

Salak builds a dependency graph; use it when present, never require it.

- If `salak` is on PATH, before answering an import, dependency or caller
  question, or before editing a file other code depends on: run
  `salak check .`, then `salak query importers|imports|symbols|callers <file>`.
  Exit 2 = edge kind not tracked, so an empty answer proves nothing.
- No graph yet → offer `salak scan .` once. Stale → `salak scan . --update`.
- Never read `project-memory/repo-graph.json` whole.
- Contract: `dev-kickoff-edho-ferdian/references/salak-integration.md`.
