# Packaging for distribution (`dist/*.skill`) — full procedure

The detail behind `SKILL.md` §6. Read it before packaging or when CI's
`validate`/`dist-sync` job fails.

Adapted per D-023 (R8) — this ecosystem produces `.skill` archives in `dist/`
for manual upload (Claude.ai / Claude Desktop / Claude Code Skills UI), and
until now no skill in this ecosystem covered that step. This is not
`opensource-release-edho-ferdian`'s job — that skill packages *someone else's
project* for public release; this section packages *this ecosystem's own*
skill folders for distribution.

### When to package

Package a skill into `dist/*.skill` whenever `skills/<name>/` changes and
the change is going to be committed — CI (`.github/workflows/ci.yml`,
`dist-sync` job) fails the build if `dist/` drifts from `skills/`, so
"stale and unpublished" is no longer just a convention to remember, it's an
enforced gate. Packaging is not automatic on every keystroke — run it as
the last step before committing, same as running a formatter.

### Pre-package validation

`scripts/validate_skills.py` runs this automatically (also enforced in CI
as the `validate` job) — run it yourself before packaging rather than
waiting for CI to catch it:

```bash
python scripts/validate_skills.py
```

It checks: valid frontmatter with non-empty `name`/`description`,
description length ≤1024 chars (the harness display limit this ecosystem
was bitten by twice), no "ECC" mentions outside the one deliberate
exception (`config-hygiene-edho-ferdian`), and no reference to a
`references/*.md` file that doesn't exist anywhere in the repo. It does
**not** check absolute local paths (`C:\Users\...`, `/home/...`) or leaked
secrets — those need human judgment to avoid false positives in CI, so
they stay part of a manual `skill-audit-edho-ferdian` pass, not this
automated gate.

### Packaging

```bash
python scripts/package_skills.py            # all 38 skills
python scripts/package_skills.py <name>      # just one
python scripts/package_skills.py --check     # dry run — exit 1 if stale, same check CI runs
```

This is the only way `dist/*.skill` should be produced now — it writes
forward-slash paths (a `.skill` zipped with Windows-style backslash paths
can fail to install correctly on non-Windows systems) and a fixed internal
timestamp, so re-running it produces byte-identical output and CI's
`--check` diff is meaningful. Don't hand-zip a skill folder; the archive
root must be the skill's own files with no wrapping folder, which the
script already guarantees.

### Drift check

CI enforces this now (`dist-sync` job runs `package_skills.py --check` on
every push/PR) — a PR that changes `skills/` without repackaging `dist/`
fails CI rather than silently shipping a stale archive.

### What this section does not cover

Publishing the packaged skill anywhere (a marketplace, a shared drive, a
repo release) is a separate, explicit-permission action — this section only
covers producing a correct local archive.
