# Worked Migration — renaming and splitting a column with zero downtime

An expand–contract change from `migrations.md` carried out step by step
with Prisma and Postgres, including the backfill, the deploy order and
the cache. The same sequence applies to any ORM.

## The change

`customers.name` (one string) must become `first_name` + `last_name`.
The app is live; old and new versions of the code run side by side
during a rolling deploy.

## Why not one migration

```prisma
// ✗ one-step rename: breaks every running old instance the moment it applies
model Customer { firstName String  lastName String }   // name dropped
```

Old instances still `SELECT name` → errors until they're replaced. Data in
`name` would also need splitting in the same transaction as the drop.

## Phase 1 — Expand (additive, safe to deploy before the code)

```prisma
model Customer {
  id        String  @id @default(uuid())
  name      String                // still the source of truth
  firstName String? @map("first_name")
  lastName  String? @map("last_name")
}
```

```bash
npx prisma migrate dev --name customer_name_expand
```

Generated SQL — check it adds nullable columns only (no rewrite, no lock
held for long):

```sql
ALTER TABLE "customers" ADD COLUMN "first_name" TEXT, ADD COLUMN "last_name" TEXT;
```

## Phase 2 — Dual write (code deploy)

Every write sets both shapes; reads still use `name`.

```ts
function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };   // "Siti Nur Aisyah" → "Siti" + "Nur Aisyah"
}

await db.customer.update({
  where: { id },
  data: { name: input.name, ...splitName(input.name) },
});
```

Single-name customers (common in Indonesia, e.g. "Sukarno") get an empty
last name — decide that rule with the product owner, then test it.

## Phase 3 — Backfill in batches (no long locks, resumable)

```ts
// scripts/backfill-customer-names.ts
const BATCH = 1_000;
let lastId = "";
for (;;) {
  const rows = await db.customer.findMany({
    where: { firstName: null, id: { gt: lastId } },
    orderBy: { id: "asc" },
    take: BATCH,
    select: { id: true, name: true },
  });
  if (!rows.length) break;
  await db.$transaction(rows.map((r) => db.customer.update({ where: { id: r.id }, data: splitName(r.name) })));
  lastId = rows[rows.length - 1].id;
  console.log(`backfilled up to ${lastId}`);
  await new Promise((r) => setTimeout(r, 100));        // give the DB room between batches
}
```

Or in one SQL statement per batch:

```sql
UPDATE customers SET first_name = split_part(name, ' ', 1),
                     last_name  = nullif(substr(name, length(split_part(name, ' ', 1)) + 2), '')
WHERE id IN (SELECT id FROM customers WHERE first_name IS NULL ORDER BY id LIMIT 1000);
```

Verify completeness before moving on:

```sql
SELECT count(*) FROM customers WHERE first_name IS NULL;   -- must be 0
```

## Phase 4 — Switch reads (code deploy)

Read `firstName`/`lastName` everywhere; keep writing `name` too, so a
rollback to the previous version still works.

```bash
rg -n "\.name\b" src | rg -i customer      # find remaining reads of the old field
```

## Phase 5 — Contract (after the new code has been stable)

```prisma
model Customer {
  id        String @id @default(uuid())
  firstName String @map("first_name")
  lastName  String @default("") @map("last_name")
}
```

```sql
ALTER TABLE "customers" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "customers" DROP COLUMN "name";
```

`SET NOT NULL` scans the table; on very large tables add a
`CHECK (first_name IS NOT NULL) NOT VALID`, then `VALIDATE CONSTRAINT`,
then set NOT NULL, to keep the lock short.

## Deploy order and rollback per phase

| Phase | Deploy | Safe rollback |
|---|---|---|
| 1 Expand | migration | drop the new columns |
| 2 Dual write | code | previous code (new columns just stop updating) |
| 3 Backfill | script | none needed (idempotent; re-run) |
| 4 Switch reads | code | previous code (still reads `name`, still written) |
| 5 Contract | migration + code | restore from backup only — wait until confident |

## The cache

If customers are cached (Redis), the cached shape changes in phase 4:

```ts
const key = `customer:v2:${id}`;      // bump the key version with the shape change
```

Old entries under `customer:v1:*` expire on their own TTL; never read an
old-shape value with new code.

## Indexes on large tables (Postgres)

```sql
CREATE INDEX CONCURRENTLY customers_last_name_idx ON customers (last_name);
```

Prisma wraps migrations in a transaction, and `CONCURRENTLY` can't run in
one — put it in its own migration file and mark it to run outside the
transaction, or apply it with a separate step.

## Tests

- `splitName` table test (one name, two names, extra spaces, three parts).
- Migration test in CI: apply all migrations to an empty database and to a
  copy of production-like data; run the backfill; assert no NULLs.
