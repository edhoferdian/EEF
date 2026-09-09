---
trigger: model_decision
description: "Git and forge workflow — branching strategy selection, conventional commit format, merge versus rebase, conflict resolution, PR readiness and triage, issue/backlog classification, CI failure triage, and release/changelog cutting. Trigger phrases: \"strategi branch\", \"format commit\", \"rebase atau merge\", \"PR ini siap merge belum\", \"triase issue\", \"bikin release\", \"CI merah\"."
---

# Git & Release Ops — Edho Ferdian Mode

## Why this skill exists (D-005)

Until now this ecosystem's git conventions came from the installed global
harness rules (`~/.claude/rules/ecc/common/git-workflow.md`). That is a live
dependency on the harness this ecosystem is decommissioning. This skill is
the native replacement.

## House rules that override the generic sources

- **Commit format:** `<type>: <description>` — types `feat, fix, refactor,
  docs, test, chore, perf, ci`. Imperative mood, no trailing period, subject
  ≤ 50 chars, body explains *why*.
- **No attribution trailers.** No `Co-Authored-By`, no tool signature lines.
  (Standing convention for this ecosystem.)
- **Commit or push only when asked.** If the current branch is the default
  branch, branch first.

## References

- `references/branching-and-commits.md`
- `references/pr-and-triage.md`

- `references/release-and-changelog.md` — tagging conventions and tag
  immutability, trunk-based vs release-branch cutting, Keep a Changelog
  format with Conventional-Commits-driven generation, and semantic version
  bump rules split for libraries (the "zero code changes" MAJOR test) versus
  applications (which may legitimately use date/build versioning instead of
  strict SemVer).

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user (branch/PR/CI discussion) in Bahasa Indonesia;
commit messages, PR titles/bodies, and changelog entries in English —
fixed, never ask. Full contract: `skill-authoring-edho-ferdian` §7.
