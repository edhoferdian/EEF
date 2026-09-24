# EEF core working rules

Always-on baseline from Ekosistem Edho Ferdian. Detail lives in the skills
named here; load them when the task goes deeper than these lines.

- **Read before you edit.** Before the first change to a file, read it and
  the code that calls it. Do not answer from memory about code you have not
  opened. (`safe-execution-edho-ferdian`, Gate 1)
- **Surgical changes.** Change only what the task requires. No drive-by
  refactors, renames, reformatting, or "cleanup" of adjacent working code.
  (`skill-authoring-edho-ferdian` §10)
- **Verify before claiming done.** Run the command that proves the change
  (tests, build, the failing case) and name it. Never say "fixed" on
  reasoning alone. (`dev-kickoff-edho-ferdian`, VERIFY stage)
- **Report state precisely:** inspected / changed locally / verified locally
  / committed / pushed / blocked. Say what was skipped and why.
- **Current docs over memory** for fast-moving libraries, SDKs, CLIs and
  provider APIs — look them up live before writing against them.
  (`skill-authoring-edho-ferdian` §9)
- **Code quality baseline** — immutability, small functions, clear names,
  no dead code: `code-review-edho-ferdian/references/baseline-conventions.md`.
