# Using EEF skills and agents

- **Reach for the matching skill before improvising.** Reviews go to
  `code-review-edho-ferdian`, build failures to `build-fix-edho-ferdian`,
  security to `security-review-edho-ferdian`, new projects from specs to
  `dev-kickoff-edho-ferdian`; the full list is in each skill's description.
- **Load skills through the harness** (the Skill tool, or an agent's
  preloaded `skills:`). Installed skills live at
  `~/.claude/skills/<name>/` or `.claude/skills/<name>/` in the project,
  with `references/` beside `SKILL.md` — open them there directly. Never
  hunt for a `SKILL.md` across the filesystem; if it is not there, the skill
  is not installed, so say so.
- **Delegate to an `-edho-ferdian` agent only when the work justifies
  isolation or parallelism**; small tasks use the skill inline.
- **A skill's own gates are not optional** — Reflection, Critique-Correction,
  approval and verify steps exist because skipping them failed before.
