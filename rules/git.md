# EEF git rules

- **Conventional commits:** `type(scope): subject` with types `feat`, `fix`,
  `refactor`, `docs`, `test`, `chore`, `perf`, `ci`. Subject in the
  imperative, explaining why when it is not obvious.
- **Commit or push only when asked.** On the default branch, branch first.
- **Never bypass hooks or signing** (`--no-verify`, `--no-gpg-sign`). If a
  hook fails, fix the cause.
- **Prefer a new commit over amending** shared history; never force-push a
  shared branch without an explicit instruction.
- Branching strategy, PR readiness, CI triage and releases:
  `git-and-release-ops-edho-ferdian`.
