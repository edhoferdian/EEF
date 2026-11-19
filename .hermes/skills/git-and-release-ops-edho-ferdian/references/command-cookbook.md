# Command Cookbook — git situations, with the exact commands

Non-interactive forms throughout (agents can't drive `git rebase -i` or an
editor). House rules in SKILL.md win: conventional commits, branch before
committing on the default branch, no `--no-verify`, no force push on shared
branches without an explicit instruction.

## Commit messages

```text
feat(cart): apply coupon before shipping is calculated
fix(auth): refresh the token before it expires, not after
refactor(api): split order handlers by resource
perf(search): index products.name with pg_trgm
docs(readme): document the PAYMENT_WEBHOOK_SECRET variable
test(checkout): cover double-submit of the pay button
chore(deps): bump next from 15.1 to 15.2
ci: cache pnpm store between jobs
```

Subject in the imperative, ≤ 72 chars, scope = the area touched. Body
explains *why* when it isn't obvious. Breaking change:

```text
feat(api)!: return amounts in minor units

BREAKING CHANGE: `amount` is now an integer in sen; divide by 100 for rupiah display.
```

## Start work safely

```bash
git switch main && git pull --ff-only
git switch -c feat/coupon-before-shipping
```

## Update a branch with main

```bash
# Own branch, not shared: rebase for a linear history
git fetch origin
git rebase origin/main
# Shared branch (others pushed to it): merge instead
git merge origin/main
```

## Resolve a conflict

```bash
git status                                  # list conflicted files
git diff --name-only --diff-filter=U
# edit each file, keeping both intents; then
git add <file>
git rebase --continue                       # or: git merge --continue
# give up and return to before the rebase
git rebase --abort
```

For lockfiles: take one side, then regenerate:

```bash
git checkout --theirs package-lock.json && npm install && git add package-lock.json
```

## Squash / fix up commits without an editor

```bash
# Make a fixup for an earlier commit
git commit --fixup=<sha>
# Apply all fixups non-interactively
GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash origin/main
```

## Undo, by situation

| Situation | Command |
|---|---|
| Unstage a file | `git restore --staged <file>` |
| Discard edits to one file | `git restore <file>` |
| Change the last commit message (not pushed) | `git commit --amend -m "…"` |
| Undo the last commit, keep changes | `git reset --soft HEAD~1` |
| Undo a pushed commit on a shared branch | `git revert <sha>` |
| Recover a "lost" commit | `git reflog` → `git branch rescue <sha>` |
| Committed on main by mistake (not pushed) | `git branch feat/x && git reset --hard origin/main && git switch feat/x` (back up first, Gate 2) |

## Find the commit that broke something

```bash
git bisect start
git bisect bad HEAD
git bisect good v1.4.0
git bisect run npm test -- --run tests/checkout.test.ts
git bisect reset
```

## Bring one fix to another branch

```bash
git switch release/1.4
git cherry-pick -x <sha>      # -x records the origin in the message
```

## Pull requests (gh)

```bash
gh pr create --base main --title "fix(auth): refresh token before expiry" --body-file pr.md
gh pr view --web
gh pr checks <n>
gh pr diff <n> --name-only
gh pr merge <n> --squash --delete-branch        # only when the user asked to merge
```

PR body:

```markdown
## Why
<problem, with the user-visible symptom>

## What
- <change 1>
- <change 2>

## Verification
- `npm test` — 214 passed
- Manually: <steps>

## Risk / rollback
<what could break; revert this PR to roll back>
```

## CI is red — triage

```bash
gh run list --branch <branch> --limit 5
gh run view <run-id> --log-failed | tail -100
gh run rerun <run-id> --failed                 # only for a proven flake
```

Order: reproduce the failing command locally → fix the cause → push. A
rerun is not a fix; a flaky test gets a ticket and a quarantine note.

## Releases

Semver decision:

| Change since last release | Bump |
|---|---|
| Breaking API/CLI/config change | major |
| New feature, backwards compatible | minor |
| Fixes, docs, internal refactors | patch |

```bash
git tag -a v1.5.0 -m "v1.5.0"
git push origin v1.5.0
gh release create v1.5.0 --generate-notes --verify-tag
# changelog from conventional commits since the last tag
git log v1.4.0..HEAD --pretty="- %s (%h)" --no-merges
```

Publishing to a registry (npm, PyPI) and deploying are outward-facing:
only on the user's explicit go-ahead.

## Hygiene

```bash
git branch --merged main | grep -vE '^\*|main' | xargs -r git branch -d   # delete merged local branches
git remote prune origin
git log --oneline --graph --decorate -20
```
