# CI/CD pipeline gates

Wiring the pipeline that stands between a commit and a deploy: gate order,
required-status-checks, branch protection, a concrete GitHub Actions
structure, caching, and how to fail loud versus fail quiet.

## Gate order, and why it's an order

Gates run cheapest-and-fastest first so a doomed change fails in seconds, not
after a 10-minute build:

```
lint  →  typecheck  →  unit test  →  security scan  →  build  →  deploy
 ~10s      ~20s          ~1-3min       ~1-2min          ~2-5min    ~varies
```

- **Lint and typecheck first.** They catch the largest share of trivial
  breakage for the lowest cost. A syntax or type error should never be
  discovered by a test run three minutes in.
- **Unit tests before security scanning.** Security scanning (dependency
  audit, SAST) is usually slower and less frequently the actual failure
  cause — don't make every contributor wait on it before finding out their
  test broke.
- **Build after tests, not before.** A build that succeeds against code that
  fails its own tests is not useful evidence; don't spend build minutes on
  code you haven't already validated logically.
- **Deploy last, and gated on everything above being green.** No stage skips
  ahead of a red predecessor — a pipeline that lets "build" run while "test"
  is still failing has already stopped being a gate.

This order is a default, not a law: if a project's security scan is
genuinely fast and its unit tests are genuinely slow, reordering to fail
faster is correct. The invariant is "cheapest and most-likely-to-fail runs
first," not "this exact list in this exact sequence."

## Required status checks (GitHub branch protection)

A CI job that runs but is not *required* is a suggestion, not a gate — a red
job that nobody is blocked by will eventually be ignored. Configure branch
protection so the branch cannot receive a merge unless every gate reports
success:

1. Repo → Settings → Branches → Branch protection rules → add rule for the
   default branch (and any long-lived release branches).
2. Enable **"Require status checks to pass before merging."**
3. Select each CI job by its exact name as it appears in the Actions run
   (`lint`, `typecheck`, `test`, `security-scan`, `build` — whatever the
   workflow's `jobs.<id>.name` or job id resolves to). Adding a check here
   before the workflow has ever run once will not find it in the list — run
   the workflow once first, then add it.
4. Enable **"Require branches to be up to date before merging"** so a stale
   branch (see `references/pr-and-triage.md` in
   `git-and-release-ops-edho-ferdian`) cannot merge on checks that ran
   against an outdated base.
5. Enable **"Require a pull request before merging"** and set the minimum
   approval count — this is a review-process gate, not a CI gate, but it
   belongs in the same rule set.
6. Consider **"Do not allow bypassing the above settings"** for the default
   branch — an admin override that's always available quietly becomes the
   normal path the first time CI is inconvenient.

**A renamed CI job silently stops being required.** If a workflow job's name
changes (`test` → `unit-test`), the old required-check name no longer
matches anything GitHub reports, and the branch protection rule for it goes
permanently green by omission — it looks satisfied because nothing is
failing it, but nothing is running it either. Re-verify the required-checks
list after any workflow rename.

## Branch protection rules — the rest of the checklist

Beyond required status checks:

- **No force-push to the default branch.** Rewriting shared history breaks
  every other contributor's local state and any in-flight PR based on it.
- **No direct pushes to the default branch** — even for maintainers, route
  through a PR so CI actually runs before the change lands.
- **Require conversation resolution before merging** — an unresolved review
  comment merged silently is a common way real feedback gets lost.
- **Require signed commits** if the project has a compliance or supply-chain
  reason to (not a default for most projects — real cost for real teams;
  don't cargo-cult it in).

## Pipeline structure — GitHub Actions

One workflow, gates as separate jobs, running in parallel where they have no
dependency on each other, with `needs` expressing genuine ordering:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    needs: [lint, typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run test -- --coverage
      - uses: actions/upload-artifact@v4
        with: { name: coverage, path: coverage/ }

  security-scan:
    runs-on: ubuntu-latest
    needs: [lint, typecheck]
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      # SAST / secret-scan tooling goes here (e.g. semgrep, gitleaks)

  build:
    runs-on: ubuntu-latest
    needs: [test, security-scan]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with: { name: build-output, path: dist/ }

  deploy:
    runs-on: ubuntu-latest
    needs: [build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: production
    steps:
      - uses: actions/download-artifact@v4
        with: { name: build-output, path: dist/ }
      - run: ./scripts/deploy.sh
```

Notes on this structure:

- `lint` and `typecheck` have no `needs` — they run in parallel immediately,
  which is where most of the "fail fast" benefit comes from in practice.
- `test` and `security-scan` both depend on the two fast gates but not on
  each other — they also run in parallel, since neither's outcome informs
  the other.
- `deploy` is gated on `build`, and additionally gated on branch and event
  type with `if:` — a PR run never reaches deploy even if every prior job
  passes, because pushing an untrusted PR branch's artifact to production is
  exactly the mistake this gate exists to prevent.
- `concurrency` with `cancel-in-progress: true` kills a superseded run when
  new commits land on the same PR — without it, pushing three commits in a
  minute queues three full pipeline runs instead of one.

## Caching strategy for CI speed

- **Cache the package manager's download cache, not `node_modules`
  directly** where the tooling supports it — `actions/setup-node`'s
  built-in `cache: npm` (shown above) keys on the lockfile hash and is
  simpler and safer than a hand-rolled `actions/cache` block for
  `node_modules`, which can go stale across OS/arch changes.
- **Key the cache on the lockfile hash**, not a static string. A cache keyed
  `"deps-v1"` never invalidates when a dependency actually changes, silently
  serving stale packages to a build that should have picked up the update.
- **Cache build output between stages, not just dependencies** — the
  `upload-artifact`/`download-artifact` pair above means `build` runs once
  and `deploy` reuses its output, rather than re-running the build inside
  the deploy job.
- **Don't cache secrets or credentials into an artifact** — build artifacts
  and dependency caches are both potentially shared or inspectable; treat
  them the same as any other output that should never carry a secret.
- **Watch cache size growth.** An unbounded cache (e.g. accumulating every
  historical lockfile hash's entry) eventually exceeds the CI provider's
  cache storage limit and starts silently evicting the entries you actually
  want kept warm.

## Fail fast vs fail informatively

These are not opposites to balance — they answer different questions and a
good pipeline does both:

- **Fail fast** is about *when* the pipeline stops: don't run a 5-minute
  build against code that already failed lint. This is what gate ordering
  and `needs` accomplish.
- **Fail informatively** is about *what the failure tells the reader*: when
  a gate does fail, the log and the PR status must say which check failed,
  on which file/line, and — for a flaky-suspect failure — whether it's
  worth re-running or worth reporting (see
  `git-and-release-ops-edho-ferdian/references/pr-and-triage.md`'s
  CI-failure-triage section, which this file defers to rather than
  restating).
- A pipeline that fails fast but uninformatively (a red X with no readable
  cause, forcing the author to re-run locally to find out what broke) has
  optimized the wrong half of the problem — the CI minutes saved are given
  right back as the author's own debugging time.
- Concretely: surface the actual failing assertion or lint rule in the job
  summary (most linters and test runners have a CI-annotation output mode —
  use it), not just an exit code and a generic "Process completed with exit
  code 1."

## Anti-patterns

| Anti-pattern | Why it hurts | Instead |
|---|---|---|
| Security scan or build before unit tests | Slow gates burn CI minutes on code already known-broken by a faster gate | Cheapest/most-likely-to-fail gates first |
| CI job not added to required status checks | A red job blocks nobody; eventually gets ignored | Add every gate to branch protection's required checks |
| Deploy job with no branch/event guard | A PR build from an untrusted branch can reach the deploy step | Gate deploy on `ref == default-branch` and `push`, not `pull_request` |
| Cache keyed on a static string | Never invalidates on real dependency changes; serves stale packages | Key on the lockfile hash |
| No `concurrency` / cancel-in-progress | Every push queues a full redundant pipeline run | `concurrency.group` + `cancel-in-progress: true` |
| Renaming a CI job without updating branch protection | Required-check silently stops matching anything; passes by omission | Re-verify required checks after any job rename |
| Exit code only, no annotated failure detail | Fails fast but pushes debugging time back onto the author | Emit CI-annotated failure output (file/line/assertion) |

## Notes

Drawn from general industry practice around GitHub Actions and CI/CD gate
design (GitHub's own branch-protection and required-status-checks
documentation, common multi-stage pipeline conventions). This file
complements `references/production-readiness.md` (which hard-caps a launch
score when CI is not green) and `references/release-strategies.md` (which
this pipeline's `deploy` stage feeds into) in this same skill.
