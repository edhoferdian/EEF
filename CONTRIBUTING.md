# Contributing to Ekosistem Edho Ferdian (EEF)

Thanks for considering a contribution. This project is a solo-maintained
skill ecosystem, so the bar and the process are kept deliberately simple.

By participating, you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Search first.** Check [`skills/`](skills/) for something close to what
  you want to add or fix — a near-match is usually a case for extending an
  existing skill's `references/` folder, not a new top-level skill.
- **For anything non-trivial, open an issue before a PR.** A new skill, a
  new cross-harness adapter, or a change to `scripts/` is easier to agree
  on before the work is done than after.
- **Small fixes** (typos, a broken cross-reference, a stale description)
  can go straight to a PR.

## What a skill actually is

Every skill lives at `skills/<name>/SKILL.md`, with an optional
`skills/<name>/references/*.md` for material that doesn't need to load on
every invocation. `SKILL.md` needs valid YAML frontmatter with `name` and
`description` — `description` is the trigger mechanism (what tells an AI
agent when to load this skill), so it needs concrete phrases someone would
actually type, not abstract category words. Look at a few existing skills
before writing a new one; the pattern is more important to match than any
single rule here.

## Required checks before opening a PR

Run these from the repo root — CI runs the same checks and will fail the
build if any of them fail:

```bash
# Structural checks: frontmatter, description length, broken references
python scripts/validate_skills.py

# Repackage dist/*.skill if you touched anything under skills/
python scripts/package_skills.py

# Regenerate every cross-harness adapter if you touched anything under skills/
python scripts/export_agents_md.py
python scripts/export_gemini_md.py
python scripts/export_cursor.py
python scripts/export_windsurf.py
python scripts/export_cline.py
python scripts/export_copilot.py
python scripts/export_kiro.py

# Sanity-check the npm CLI still lists what you expect
node bin/eef.js --list
```

Forgetting to regenerate an adapter is the single most common way to fail
CI here — every `export_*.py` script has a `--check` flag that mirrors
what CI runs, so `python scripts/export_cursor.py --check` (etc.) tells you
before you push whether something drifted.

## Parallel sessions and agents

This repo is often worked on by several Claude Code sessions (or other
agents) at once, local and cloud. On 2026-10-08 a cloud session pushed
straight to `main` while a local session had unpushed work: the local work
had to be rebased, and one cloud commit overwrote a committed benchmark
summary with a one-run spot check. The rules below exist so that cannot
happen silently again; they apply to humans and agents alike.

- **Work on a branch, land through a PR.** Every session works on its own
  branch (a worktree per session, when local) and opens a PR to `main`.
  Never push to `main` directly, even for a one-line fix or a release
  bump — a PR is where CI runs against current `main`.
- **Never force-push `main`**, and never force-push another session's
  branch. Rebase or merge `main` into your own branch to catch up.
- **Bring your branch up to date before merging.** If `main` moved since
  your branch was cut, merge or rebase it in and let CI run again: green
  CI on an old base says nothing about the combination.
- **Benchmark records are append-only.** A scoring pass of
  `evals/review-seeded-bugs/run.py` writes a new
  `results*/runs/<UTC time>-<label>.json`; commit it under an honest label
  (`spot-check`, `full-run`, ...) and never edit or delete a committed
  one — the pre-commit hook and CI reject it. See
  [`evals/review-seeded-bugs/README.md`](evals/review-seeded-bugs/README.md).
- **Generated files are regenerated, not hand-merged.** On a conflict in
  `AGENTS.md`, `CATALOG.md`, `dist/` or another export, take either side
  and re-run the generator (`python scripts/<generator>.py`).

## Adding a new cross-harness adapter

If you want to add support for a coding agent this repo doesn't cover yet:
first check whether it already reads [`AGENTS.md`](AGENTS.md) — several
tools (Codex, OpenCode, Muse Code, Zed, Google Antigravity, Cline) do this
automatically and need no dedicated adapter at all. Only build a new
`scripts/export_<target>.py` if the tool needs its own file format,
location, or per-file scoping AGENTS.md can't express. Confirm the exact
schema against that tool's own documentation before writing code — this
project has been burned before by trusting search-engine summaries over
primary sources.

## Commit and PR conventions

- Conventional-commit-style prefixes (`feat:`, `fix:`, `docs:`, `chore:`)
  are appreciated but not enforced.
- Keep the diff scoped to one change — a new skill and an unrelated
  refactor belong in separate PRs.
- No AI-attribution trailers in commit messages or PR descriptions.

## Reporting a security issue

Don't open a public issue for a security concern — see
[SECURITY.md](SECURITY.md) instead.

## Questions

Open a GitHub issue, or see the [Enterprise inquiry](README.md#enterprise-inquiry)
section of the README if you need a faster or more involved response than
a public issue thread.
