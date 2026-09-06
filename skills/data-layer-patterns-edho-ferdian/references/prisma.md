# Prisma — Design-Time Setup & Patterns

Adapted from ECC `prisma-patterns`, fetched 2026-09-04.

**Check the installed version before applying anything here** — the Prisma
API surface has moved across major releases (adapter-based `PrismaClient`
construction, `relationJoins`, `omit`, `prisma.config.ts` replacing
`datasource.url` in newer installs). Run:

```bash
npx prisma --version
```

## Connection pooling configuration

Each `PrismaClient` instance owns its own connection pool — instantiate
**once** per process, not per request:

```ts
// lib/prisma.ts
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

The `globalThis` cache prevents duplicate pools across hot-reload cycles
(Next.js, nodemon, ts-node-dev) — without it, dev-mode reloads leak
connections until the database refuses new ones.

**`connection_limit` and serverless.** In Lambda/Vercel/Cloudflare Workers,
every function instance opens its own pool — cap each to 1 and put a real
pooler in front:

```bash
# Embed params directly in the URL — string-concatenating them breaks if
# the URL already has query params (e.g. ?schema=public)
DATABASE_URL="postgresql://user:pass@host/db?connection_limit=1&pool_timeout=20"

# With PgBouncer / Supabase's pooler
DATABASE_URL="postgresql://user:pass@host/db?pgbouncer=true&connection_limit=1"
```

**pgBouncer compatibility mode** matters here: PgBouncer's transaction
pooling mode doesn't support prepared statements the way Prisma expects by
default — pass `pgbouncer=true` in the connection string so Prisma disables
prepared-statement caching and stays compatible. Without it, expect
intermittent "prepared statement already exists" errors under load that are
hard to reproduce locally (a single-connection dev setup never hits the
pooler's statement-reuse behavior).

## The N+1 trap specific to Prisma's relation loading

`include` and `select` look interchangeable at a glance but behave very
differently under load:

| | `include` | `select` |
|---|---|---|
| Returns | All scalar fields + specified relations | Only specified fields |
| Use when | You need most fields plus a relation | Hot paths, large tables, avoiding over-fetch |
| Prisma 5+ (`relationJoins`) | Single JOIN by default | Same |

The trap: code that *looks* like it avoids N+1 (a single `findMany` call
with `include`) can still generate N+1 queries under the hood on older
Prisma versions or specific relation shapes, and even with `relationJoins`
enabled, a JOIN against a large 1:N relation can explode the result set size
instead of issuing extra queries — trading one performance problem for
another. Benchmark both shapes when a relation can return many rows per
parent; don't assume `include` is free just because it's one Prisma call.

The unambiguous N+1 shape to catch in design review — loading a relation
inside a loop:

```ts
// BAD — one extra query per user
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { authorId: user.id } });
}

// GOOD — single query (or single JOIN on Prisma 5+)
const users = await prisma.user.findMany({ include: { posts: true } });
```

Never return raw Prisma entities from an API response — map to a DTO so
`include`'s "all scalar fields" behavior doesn't leak columns you didn't
mean to expose (`passwordHash`, `deletedAt`, internal flags):

```ts
const user = await prisma.user.findUniqueOrThrow({ where: { id } });
return { id: user.id, name: user.name, email: user.email };
```

## Migration workflow: `migrate dev` vs `migrate deploy`

These are not interchangeable, and picking the wrong one in the wrong
environment is the single most common Prisma incident:

| Command | Where | Behavior |
|---|---|---|
| `prisma migrate dev` | Local solo dev only | Detects schema drift and **may prompt to reset the database**, dropping all data |
| `prisma migrate deploy` | CI/CD, staging, production | Applies pending migrations only — never resets, never prompts |

```bash
# NEVER on shared dev, staging, or production
npx prisma migrate dev --name add_column

# Safe everywhere except local solo dev
npx prisma migrate deploy

# Check drift without applying anything
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL"
```

Set this up once at project init: CI/CD pipelines call `migrate deploy`
exclusively; `migrate dev` never appears outside a developer's local
machine or its own dev-only npm script. Baking this into the setup (rather
than trusting every future contributor to remember it) is a design-time
decision, not a review-time catch.

For changes Prisma can't express (concurrent index creation, manual data
backfills), create an empty migration and hand-edit the SQL:

```bash
npx prisma migrate dev --create-only --name add_email_index
```

```sql
-- Prisma can't generate CONCURRENTLY — write it by hand
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users (email);
```

Never edit a migration file after it has run anywhere — Prisma checksums
every migration and a mismatch (`P3006`) breaks every environment where the
original already applied. Create a new migration instead. For the full
expand-contract sequencing of a breaking schema change, see
`references/migrations.md`.

## Schema-design conventions specific to Prisma's schema language

**ID strategy** — pick one at setup time, per the trade-offs in
`references/postgres.md`:

| Strategy | Use when | Avoid when |
|---|---|---|
| `@default(cuid())` | Default choice — URL-safe, sortable, no collisions | Sequential IDs needed for external systems |
| `@default(uuid())` | Interoperability with a non-Prisma system requires it | High-write tables (random UUIDs fragment the B-tree) |
| `@default(autoincrement())` | Internal join tables, audit logs | Public-facing IDs (exposes record count) |

**Baseline model shape:**

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique  // @unique already creates an index — no extra @@index needed
  name      String
  role      Role      @default(USER)
  posts     Post[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@index([createdAt])
  @@index([deletedAt, createdAt]) // composite for soft-delete + sort queries
}
```

- Add `@@index` on every foreign key and every column used in `WHERE` or
  `ORDER BY` — Prisma does not do this automatically.
- Declare `deletedAt DateTime?` up front if soft delete is a foreseeable
  requirement. Adding it later means a migration on a table that already
  has live traffic; deciding now is free.
- `@updatedAt` fires automatically only on `update` and `upsert` — bulk
  writes (`updateMany`) leave it stale unless set explicitly
  (`data: { ..., updatedAt: new Date() }`). Design any bulk-write path with
  this in mind rather than discovering it in a review later.
- `updateMany`/`deleteMany` return `{ count }`, never the affected rows —
  if the caller needs the updated records, capture the target IDs first,
  mutate, then re-fetch by ID.

## Related

- `references/postgres.md` — schema/index decisions at the Postgres level
- `references/migrations.md` — cross-ORM expand-contract sequencing
- `references/redis.md` — when caching is the better tool than a
  materialized read model
