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
- **Inline by default; an agent is the exception.** Each agent starts cold
  and pays again for prompt, tools, skill and file reads, so it burns quota
  fast. Delegate only when one holds:
  - **Independence is the point** — a critic, evaluator or sanitizer that
    must not inherit the author's reasoning.
  - **Huge raw output** — a sweep across many files where only the
    conclusion should reach this context.
  - **Large, truly independent pieces** that run in parallel.
  Never delegate a small task, one this session already has the context
  for, or one the user asked to keep here. If unsure, do it inline.
- **A skill's own gates are not optional** — Reflection, Critique-Correction,
  approval and verify steps exist because skipping them failed before.
