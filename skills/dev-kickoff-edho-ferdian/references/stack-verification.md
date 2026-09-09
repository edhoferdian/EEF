# Stack Verification — Concrete Command Sets

Reference for Stage 5 (VERIFY) of `execution-loop.md`. VERIFY itself is
stack-agnostic by design — "run the real tooling: build, linter,
type-checker, and the full relevant test suite" — but that instruction gives
no concrete commands. This file exists to close that gap one stack at a
time: pick the section matching the project's detected stack and run those
phases instead of guessing which tool invocation applies.

If the project's stack has no section below yet, fall back to
`execution-loop.md`'s own generic instruction and note in the Reflection
block which commands you actually ran, so the gap is visible rather than
silently papered over.

---

## Django

Run in order;
stop and fix before continuing if an earlier phase is broken enough to make
a later phase's output meaningless (e.g. don't chase coverage numbers if
migrations are unapplied).

### Phase 1 — Environment

```bash
python --version                 # matches project requirements
which python                     # correct virtualenv is active
pip list --outdated
python -c "import os; print('DJANGO_SECRET_KEY set' if os.environ.get('DJANGO_SECRET_KEY') else 'MISSING: DJANGO_SECRET_KEY')"
```

Misconfigured environment → stop and fix before running anything else.

### Phase 2 — Code quality & formatting

```bash
mypy . --config-file pyproject.toml
ruff check . --fix
black . --check
isort . --check-only
python manage.py check --deploy
```

### Phase 3 — Migrations

```bash
python manage.py showmigrations
python manage.py makemigrations --check   # fails if models changed without a migration
python manage.py migrate --plan
python manage.py migrate
```

Report: pending migrations, migration conflicts, model changes with no
matching migration.

### Phase 4 — Tests + coverage

```bash
pytest --cov=apps --cov-report=html --cov-report=term-missing --reuse-db
pytest -m "not slow"
```

| Component | Target |
|-----------|--------|
| Models | 90%+ |
| Serializers | 85%+ |
| Views | 80%+ |
| Services | 90%+ |
| Overall | 80%+ |

### Phase 5 — Security scan

```bash
pip-audit
safety check --full-report
python manage.py check --deploy
bandit -r . -f json -o bandit-report.json
gitleaks detect --source . --verbose      # if gitleaks is installed
```

Report: vulnerable dependencies, security-config issues, hardcoded secrets,
`DEBUG` status (must be `False` in production).

### Phase 6 — Deployment-readiness checklist

- [ ] All tests passing
- [ ] Coverage ≥ 80%
- [ ] No unresolved security-scan findings
- [ ] No unapplied migrations
- [ ] `DEBUG = False` in production settings
- [ ] `SECRET_KEY` properly configured, `ALLOWED_HOSTS` set correctly
- [ ] Static files collected (`collectstatic`); logging configured

### Quick reference

| Check | Command |
|-------|---------|
| Environment | `python --version` |
| Type checking | `mypy .` |
| Linting | `ruff check .` |
| Formatting | `black . --check` |
| Migrations | `python manage.py makemigrations --check` |
| Tests | `pytest --cov=apps` |
| Security | `pip-audit && bandit -r .` |
| Django check | `python manage.py check --deploy` |

Report the outcome of each phase as a row in a plain markdown table (see
`references/output-scorecard.md` for this ecosystem's house style) — not as
an ASCII checklist block. Example:

| Phase | Result |
|-------|--------|
| Environment | Python 3.11.5, venv active, all env vars set |
| Code quality | mypy clean; ruff found 3 issues (auto-fixed); black/isort clean |
| Migrations | No unapplied migrations, no conflicts |
| Tests + coverage | 247 passed, 0 failed, 5 skipped — 87% overall |
| Security | 2 pip-audit vulnerabilities found — fix required |
| Deployment readiness | 6/8 checklist items met — 2 open |

---

## Node / JavaScript — resolve the test runner before the RED gate

Do not assume `npm test`. Resolve the runner once, at the start of the task,
and reuse it for the RED gate (Stage 2), GREEN (Stage 3) and full verification
(Stage 5).

**Step 1 — package manager.** Resolve in this order: `CLAUDE_PACKAGE_MANAGER`
env var → the `packageManager` field in `package.json` → the lockfile present
(`package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn,
`bun.lockb` → bun).

**Step 2 — the runner is not the package manager.** A project can install with
Bun and still run Jest or Vitest. Inspect `scripts.test` and the test files:

- `scripts.test` invokes `jest` / `vitest` → run it *through* the package
  manager (`npm test`, `pnpm test`, `yarn test`, `bun run test`).
- `scripts.test` is `bun test`, **or** test files `import { ... } from
  "bun:test"`, **or** there is no jest/vitest config and Bun is present → use
  Bun's native runner: `bun test`.

| Runner | test | watch | coverage |
|--------|------|-------|----------|
| npm | `npm test` | `npm test -- --watch` | `npm run test:coverage` |
| pnpm | `pnpm test` | `pnpm test --watch` | `pnpm test:coverage` |
| yarn | `yarn test` | `yarn test --watch` | `yarn test:coverage` |
| Bun → jest/vitest script | `bun run test` | `bun run test --watch` | `bun run test:coverage` |
| Bun native (`bun:test`) | `bun test` | `bun test --watch` | `bun test --coverage` |

`bun test` (Bun's built-in runner) and `bun run test` (the `package.json`
script) are different commands. Picking the wrong one is a common failure —
invoking Jest through `bun run` in an ESM-only project breaks, while
`bun test` runs the suite natively. With the native runner, mock through
`mock.module(...)` / `mock(...)` from `bun:test` (not `jest.mock`), and set
coverage thresholds in `bunfig.toml` under `[test]` (not the Jest
`coverageThresholds` block).

**Failure mode to avoid:** reporting `VERIFIED: NO — test command failed` when
the real cause was the wrong runner. Resolve the runner first; only then is a
failure real evidence.

Bun: `bun.lock` (current) or `bun.lockb` (older) → runner is `bun run` /
`bun test` with a Jest-like API. Do not assume npm scripts run under Node
just because `package.json` exists.

---

## Stacks planned

FastAPI, Next.js/React, Go, Rust. Add a section here, in the same
phase-by-phase shape as Django above, when one of these is next needed —
don't block on having all of them before this file is useful.

---

## Hygiene sweep — run it, do not recall it

Reflection Gate 6 asks "No hardcoded secrets/credentials?" and Gate 7 asks
for real tool output. Gate 6 is currently answered from memory; these two
commands turn it into something that produces evidence, and they belong in
Stage 5 next to build/lint/type/test rather than in REVIEW:

```bash
# secrets that made it into tracked source
git grep -nE '(sk-[A-Za-z0-9]{16,}|api[_-]?key\s*[=:]|secret\s*[=:]|BEGIN [A-Z ]*PRIVATE KEY)' -- \
  ':!*.lock' ':!*test*' | head -20

# debug statements left behind (adjust the extensions per stack)
git grep -nE '(console\.log|debugger;|pdb\.set_trace|binding\.pry)' -- src | head -20
```

Both are advisory: a hit is a finding to explain or clear, not an automatic
failure. A deliberate `console.log` in a logging module is fine; the point
is that it was seen, not assumed absent.

## Diff review — what changed that you did not intend to change

```bash
git diff --stat
git diff --name-only
```

Read every file in that list. The failure this catches is not a broken
test — it is the file the agent modified in passing that nobody asked it to
touch. That is a real and repeated failure mode for parallel agent runs in
this ecosystem, and the test suite is blind to it by construction: an
unintended change that keeps the suite green is exactly the kind that
survives to the snapshot.

Any file in the diff that has no line in the task's plan (Stage 1 step 3)
is a finding. Explain it or revert it before Stage 6.

## Compact verification report

For a task worth recording, a single block to paste into the Stage 6
snapshot alongside the guarantee table:

```
VERIFICATION — task <id>
Build:    PASS / FAIL
Types:    PASS / FAIL (<n> errors)
Lint:     PASS / FAIL (<n> warnings)
Tests:    PASS / FAIL (<x>/<y>, coverage <n>%)
Hygiene:  PASS / FAIL (<n> findings)
Diff:     <n> files changed, <n> outside the plan
Overall:  READY / NOT READY
```

The guarantee table in `execution-loop.md` Stage 5 says *what the tests
prove*; this block says *what was run*. Keep both — they answer different
questions and the second one is far cheaper to produce.
