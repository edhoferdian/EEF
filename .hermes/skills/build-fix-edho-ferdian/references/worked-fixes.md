# Worked Fixes — error in, minimal verified diff out

Six common failures taken through the loop: read the full error, find the
root cause, make the smallest change that removes it, prove it with the
same command. None of them is fixed with a cast, `@ts-ignore`, `any`,
`--force`, a disabled rule or a deleted test.

---

## 1. TypeScript: possibly undefined

```text
src/lib/cart.ts:14:22 - error TS18048: 'item.discount' is possibly 'undefined'.
14   const price = item.price - item.discount.amount;
```

**Cause:** `discount?: Discount` in the type; the code assumes it's set.

**Wrong fixes:** `item.discount!.amount`, `as Discount`, `// @ts-ignore`.

**Fix (behaviour defined for the missing case):**

```diff
- const price = item.price - item.discount.amount;
+ const price = item.price - (item.discount?.amount ?? 0);
```

**Verify:** `npx tsc --noEmit` → 0 errors; `npx vitest run src/lib/cart.test.ts` → add a case for an item without discount.

---

## 2. Next.js: `window is not defined` during build

```text
ReferenceError: window is not defined
    at src/components/Map.tsx:5:21
Error occurred prerendering page "/kontak".
```

**Cause:** a browser-only library imported at module top level in a
component rendered on the server.

**Fix:** keep the server render, load the browser-only part on the client:

```tsx
// src/app/kontak/page.tsx
import dynamic from "next/dynamic";
const Map = dynamic(() => import("@/components/Map"), { ssr: false, loading: () => <div className="h-80 rounded-lg bg-muted" /> });
```

(In the App Router, `ssr: false` must be used inside a client component;
wrap it in a small `"use client"` file if the page is a server component.)

**Verify:** `npm run build` → page `/kontak` prerenders; open it in the
browser and confirm the map loads.

---

## 3. Python: circular import

```text
ImportError: cannot import name 'User' from partially initialized module 'app.models'
(most likely due to a circular import) (app/models.py)
```

```bash
python -X importtime -c "import app.main" 2>&1 | grep -E "app\.(models|services)" | head
rg -n "^from app\.(models|services)" app/models.py app/services/*.py
```

**Cause:** `models.py` imports `services.billing` for a type hint, and
`services/billing.py` imports `User` from `models`.

**Fix:** the import is only needed for typing:

```diff
- from app.services.billing import Invoice
+ from typing import TYPE_CHECKING
+ if TYPE_CHECKING:
+     from app.services.billing import Invoice
```

and annotate with a string or `from __future__ import annotations`.

**Verify:** `python -c "import app.main"` and `pytest -q`.

---

## 4. Docker build: `npm ci` fails

```text
npm ERR! `npm ci` can only install packages when your package.json and package-lock.json are in sync.
npm ERR! Missing: zod@3.23.8 from lock file
```

**Cause:** `zod` added to `package.json` with a different package manager
(or edited by hand) without updating the lockfile.

**Fix:** regenerate the lockfile with the project's package manager and
commit it — not `npm install` in the Dockerfile.

```bash
npm install            # updates package-lock.json
git add package-lock.json && git commit -m "fix(deps): sync lockfile with package.json"
docker build .         # same command that failed
```

---

## 5. Prisma: client not generated in CI

```text
Error: @prisma/client did not initialize yet. Please run "prisma generate"
```

**Cause:** CI installs with `npm ci`, but the generate step only ran
locally (`postinstall` missing or scripts disabled).

**Fix:**

```diff
  "scripts": {
+   "postinstall": "prisma generate",
    "build": "next build"
  }
```

or an explicit `npx prisma generate` step before the build in CI.

**Verify:** fresh clone → `npm ci && npm run build` (the CI sequence).

---

## 6. Go: undefined after a refactor

```text
./handler.go:42:9: undefined: store.GetOrder
```

```bash
rg -n "func \(.*\) GetOrder|func GetOrder|FindOrder" ./internal/store
git log -p -S "GetOrder" -- internal/store | head -40
```

**Cause:** renamed to `FindOrder(ctx, id)` in the store refactor; one
caller missed.

**Fix:** update the caller to the new name and signature (pass `ctx`),
don't re-add an alias.

**Verify:** `go build ./... && go vet ./... && go test ./...`.

---

## The report line

```markdown
| Error | Root cause | Fix | Verified by |
|---|---|---|---|
| TS18048 cart.ts:14 | optional discount assumed present | default to 0 via `?? 0` | tsc 0 errors; new test "no discount" passes |
```

When the root cause is outside the code (a lockfile, an env var, a
missing build step), say so — the fix is the config, and the verification
is the original failing command.
