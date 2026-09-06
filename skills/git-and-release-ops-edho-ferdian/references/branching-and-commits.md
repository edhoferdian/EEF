# Branching, commits, and history

Adapted from ECC `git-workflow`, fetched 2026-09-04.

## Choosing a strategy

| Strategy | Fits | Cost |
|---|---|---|
| GitHub Flow (default) | Solo work and small teams shipping continuously | Almost none |
| Trunk-based | High-velocity teams with strong CI and feature flags | Requires flags + fast CI |
| GitFlow | Versioned releases with maintained older lines | Heavy; usually over-chosen |

Default to GitHub Flow. Adopt GitFlow only when you genuinely maintain
multiple released versions at once — the branch overhead is real and permanent.

## Merge vs rebase — the one rule that is not taste

Rebase rewrites history. **Never rebase a branch that anyone else has pulled,
that is already open as a shared PR, or that is a published/protected branch.**
Everything else is preference:

- Rebase your own feature branch onto `main` before opening the PR → linear,
  reviewable history.
- Merge when the branch is collaborative → the merge commit is the record of
  when two lines of work joined.
- Force-push only onto a branch you are the sole author of, and use
  `--force-with-lease`, never bare `--force`.

## Conflict resolution

Resolve conflicts on the *feature* side, not by taking one side wholesale.
After every resolution, the test suite must run again before continuing the
rebase — a conflict resolved into a green diff that never ran is a silent
regression.

## Commit hygiene

- One logical change per commit. "Fix tests" is a smell: either it belongs to
  the commit that broke them, or the tests were wrong and that is its own fix.
- Checkpoint commits during a long task are fine and encouraged
  (`dev-kickoff-edho-ferdian/references/execution-loop.md` Stage 2) — squash
  them before the PR if they do not each stand alone.
