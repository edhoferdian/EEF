# Worked Example — a TypeScript repo, from report to staged removal

Shows Phases 1–4 on a real-shaped `knip` run. Tool table and risk classes
live in `detection-and-classification.md`; the verification loop in
`removal-and-verification.md`.

## Phase 1 — detect

```bash
npx --yes knip --reporter compact > knip.txt
npx --yes depcheck --json > depcheck.json
```

`knip.txt` (trimmed):

```text
Unused files (3)
src/legacy/oldCart.ts
src/utils/formatPhone.ts
scripts/migrate-2023.ts
Unused dependencies (2)
moment  package.json
lodash  package.json
Unused exports (4)
src/lib/api.ts: fetchLegacyOrders
src/lib/date.ts: toUnix, fromUnix
src/components/Button.tsx: ButtonGroup
Unlisted dependencies (1)
zod  src/schemas/order.ts
```

Configure entry points first, or `knip` reports false positives for files
that frameworks load by convention:

```jsonc
// knip.json
{
  "entry": ["src/app/**/page.tsx", "src/app/**/route.ts", "scripts/*.ts", "src/workers/*.ts"],
  "project": ["src/**/*.{ts,tsx}"],
  "ignoreDependencies": ["@types/*"]
}
```

## Phase 1b — classify by risk

| Item | Evidence it's dead | Dynamic-use check | Risk | Stage |
|---|---|---|---|---|
| `moment` dep | no import (`rg "from ['\"]moment"` = 0) | not in config/CLI scripts | SAFE | 1 |
| `lodash` dep | 0 imports, but `lodash/` in a babel plugin config | used by tooling | KEEP | — |
| `src/utils/formatPhone.ts` | 0 importers (Salak `query importers` = 0) | no string-based import | SAFE | 2 |
| `src/legacy/oldCart.ts` | 0 importers | referenced in `docs/migration.md` | CAREFUL (docs) | 2 |
| `scripts/migrate-2023.ts` | not imported | run manually by ops? ask | ASK | — |
| `fetchLegacyOrders` | 0 references | name built dynamically? `rg "Legacy"` → none | SAFE | 3 |
| `toUnix`/`fromUnix` | 0 references in src | used in tests only | CAREFUL | 3 |
| `ButtonGroup` | 0 references | exported from package index → public API? | ASK | — |

```bash
# dynamic-use probes before trusting "0 references"
rg -n "import\(|require\(" src | rg -i "legacy|formatphone"
rg -n "fetchLegacyOrders|formatPhone" --hidden -g '!node_modules'
```

## Phase 3 — staged removal, verify between stages

```bash
git switch -c chore/remove-dead-code

# Stage 1: dependencies
npm uninstall moment
npm run build && npm test -- --run && npm run typecheck
git commit -am "chore(deps): remove unused moment"

# Stage 2: files
git rm src/utils/formatPhone.ts src/legacy/oldCart.ts
# fix the doc reference to oldCart in docs/migration.md
npm run build && npm test -- --run && npm run typecheck
git commit -m "refactor: delete unused formatPhone and legacy cart"

# Stage 3: exports
# remove fetchLegacyOrders; drop toUnix/fromUnix and their tests together
npm run build && npm test -- --run && npm run typecheck && npx --yes knip
git commit -am "refactor: drop unused date and legacy order exports"
```

One commit per stage makes each stage revertable on its own. If a stage
breaks, revert that commit and move the item to KEEP/ASK with the reason.

## Python equivalent (vulture)

```bash
vulture src/ --min-confidence 80 --sort-by-size > vulture.txt
# whitelist things used by frameworks (Django signals, Celery tasks, pytest fixtures)
vulture src/ whitelist.py --min-confidence 80
```

```python
# whitelist.py — names vulture can't see being used
from app.tasks import send_invoice  # celery task, called by name
send_invoice
```

## Duplicates (consolidation)

```bash
npx --yes jscpd src --min-lines 8 --reporters console
```

Merge duplicates only when both copies are meant to behave the same;
otherwise note it and leave it.

## Report

```markdown
## Dead code cleanup — <repo>

Removed (3 commits on chore/remove-dead-code):
- deps: moment (−289 KB in bundle analyzer)
- files: src/utils/formatPhone.ts, src/legacy/oldCart.ts (−214 lines)
- exports: fetchLegacyOrders, toUnix, fromUnix (+ 2 tests)

Kept: lodash (babel plugin), scripts/migrate-2023.ts (ask ops), ButtonGroup (public export)
Verification after each stage: build ✔, typecheck ✔, tests 412/412 ✔, knip clean for removed items
```
