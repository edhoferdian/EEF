# Migration Strategy — Cross-ORM Depth

This file covers migration strategy **generally**, across any ORM or raw
SQL. It goes deeper than the Django-specific migration-safety bullets in
`language-code-review-edho-ferdian/references/python-django.md` (which is a
*review-time* checklist item — CQ-10 — checking whether a migration already
in the repo violates these principles) and deeper than the Prisma-specific
workflow notes in `references/prisma.md` (which cover Prisma's own CLI
mechanics). Read this file when the question is "what's the safe *sequence*
of steps," regardless of which ORM is involved.

## Core principles

1. **Every schema change is a migration.** Never alter a production
   database by hand, even for a one-off fix — it leaves no audit trail and
   can't be replayed on another environment.
2. **Migrations are forward-only in production.** A "rollback" is a new
   forward migration that undoes the previous one, not a reversal of the
   deploy pipeline — this keeps every environment's migration history
   identical and replayable.
3. **Schema changes (DDL) and data changes (DML) are separate migrations.**
   Mixing them makes a migration slower (a schema lock plus a data-scan in
   one transaction), harder to reason about, and harder to roll back
   independently if only one half fails.
4. **Test against production-sized data before applying to production.** A
   migration that runs instantly on 100 local rows can lock a table for
   minutes on 10M production rows — table size, not row shape, is what
   determines lock duration for most DDL operations.
5. **Migrations are immutable once deployed.** Editing a migration file
   after it has run anywhere causes drift between environments (the ones
   that already ran the old version vs. the ones that will run the edited
   one) — create a new migration instead, always.

## The expand-contract pattern, in full

This is the general-purpose answer to "how do I change a column/table
that's already live without downtime or data loss." Every ORM-specific
migration tool (Prisma, Django, Drizzle, Kysely, golang-migrate) implements
the same underlying sequence — the syntax differs, the shape doesn't.

**Phase 1 — EXPAND.** Add the new structure without removing the old one.
The old code path keeps working unmodified.

```sql
-- Add new column, nullable or with a safe default (no rewrite lock on PG 11+)
ALTER TABLE users ADD COLUMN display_name TEXT;
```

Deploy the application change that makes it **write to both** the old and
new column/table, but still **read from the old one**. This is the
increment where both representations of the data coexist.

**Phase 2 — MIGRATE (backfill + cut over reads).** Backfill existing rows
into the new structure as a separate data migration (never combined with
the schema-adding migration from Phase 1):

```sql
UPDATE users SET display_name = username WHERE display_name IS NULL;
```

For a large table, batch the backfill rather than updating every row in one
transaction (see "Large data migrations" below). Once the backfill is
complete and verified, deploy the application change that reads from the
new column while still writing to both — this is the safety window where
you can revert the read-path change alone if something looks wrong, without
touching the schema again.

**Phase 3 — CONTRACT.** Once the new column has been the read source in
production for long enough to be confident (hours to days, not minutes),
deploy the application change that stops writing to the old column
entirely. Only after that deploy is live does the old column's removal
become a migration:

```sql
ALTER TABLE users DROP COLUMN username;
```

**Why separate deploys, not separate lines in one migration:** each phase
boundary is a point where you can stop and verify before the next
irreversible step. Collapsing phases (e.g. adding the column and dropping
the old one in the same release) removes your ability to roll back the
application without also rolling back the schema — and schema rollbacks are
the expensive, risky kind.

### Timeline example

```
Day 1  Migration adds display_name (nullable). Deploy app v2 — writes both,
       reads old.
Day 2  Run backfill migration for existing rows. Verify data consistency.
Day 2  Deploy app v3 — reads display_name, still writes both.
Day 7  (After confidence window) deploy app v4 — stops writing username.
Day 7  Migration drops username column.
```

## Zero-downtime principles beyond expand-contract

- **Never add `NOT NULL` to an existing column without a default in the
  same statement.** On most databases this forces a full table rewrite
  under a lock; add nullable or with a default first, backfill, then add
  the constraint as its own migration once every row satisfies it.
- **Create indexes concurrently on a live table.** A plain `CREATE INDEX`
  blocks writes for the duration of the build; `CREATE INDEX CONCURRENTLY`
  (Postgres) avoids that at the cost of not running inside a transaction
  block — most migration tools need explicit handling to run this outside
  their normal transactional wrapper.
- **Batch large data migrations.** Don't update every row in one
  transaction — it holds locks and a long-running transaction for the
  entire duration:

  ```sql
  DO $$
  DECLARE batch_size INT := 10000; rows_updated INT;
  BEGIN
    LOOP
      UPDATE users SET normalized_email = LOWER(email)
      WHERE id IN (
        SELECT id FROM users WHERE normalized_email IS NULL
        LIMIT batch_size FOR UPDATE SKIP LOCKED
      );
      GET DIAGNOSTICS rows_updated = ROW_COUNT;
      EXIT WHEN rows_updated = 0;
      COMMIT;
    END LOOP;
  END $$;
  ```

- **Remove application code references before dropping a column**, never
  the other way around — dropping first means any code path still
  referencing the column (including a slow-to-fully-roll-out deploy)
  errors immediately. For Django specifically, `SeparateDatabaseAndState`
  lets you remove a field from the model's state without touching the
  database yet, decoupling "the ORM stops seeing this field" from "the
  column is actually dropped."

## Migration reversibility requirements

**Every migration should have a working rollback path, and that rollback
path should be tested, not assumed.** In practice:

- A pure schema migration (add nullable column, add index) should have a
  trivial, mechanical down migration (drop the column, drop the index) —
  write it anyway; "obviously reversible" migrations are exactly the ones
  nobody tests until the day the down migration is actually needed and
  turns out to reference a column that was renamed since.
- A data migration (`RunPython`/`UPDATE` backfill) needs a genuine decision
  about reversibility, not a rubber-stamp reverse function:
  - A backfill that only **adds** derived data (seeding a lookup table,
    populating a new column from existing data with no data loss) can
    reasonably have a no-op or delete-the-seeded-rows reverse.
  - A backfill that **transforms or overwrites** existing data destructively
    (normalizing values in place, merging duplicate rows) may not be
    meaningfully reversible at all — if so, say that explicitly in the
    migration rather than writing a reverse function that silently loses
    information. An honestly irreversible migration, flagged as such, is
    safer than a reverse function that appears to work but doesn't restore
    the original state.
- **Test the down migration**, not just the up — run it against a copy of
  the target data and confirm the schema and data actually return to the
  prior state. A rollback path nobody has run is a rollback path you don't
  actually have; discovering it's broken during a real incident is the
  worst possible time.

## Anti-patterns

| Anti-pattern | Why it fails | Better approach |
|---|---|---|
| Manual SQL against production | No audit trail, not repeatable on other environments | Always go through a migration file |
| Editing a deployed migration | Causes drift between environments that already ran it and ones that haven't | Create a new migration instead |
| `NOT NULL` with no default on an existing table | Full table rewrite under lock | Add nullable/default first, backfill, then constrain |
| Inline (non-concurrent) index on a large live table | Blocks writes for the build duration | `CREATE INDEX CONCURRENTLY` |
| Schema and data changes in one migration | Hard to roll back independently, longer transaction | Separate migrations, sequenced |
| Dropping a column before removing code that references it | Application errors on the missing column | Remove code first, drop column in the next deploy |

## Related

- `code-review-edho-ferdian/references/database-lens.md` — the review-time
  counterpart: catches a migration that violates these principles, backed
  by `EXPLAIN ANALYZE`/tool output, in code that already exists.
- `language-code-review-edho-ferdian/references/python-django.md` — the
  Django-specific review checklist item (CQ-10) for migration safety;
  points here for the general pattern this skill's file states in full.
- `references/prisma.md` — Prisma's own CLI mechanics (`migrate dev` vs
  `migrate deploy`) for executing this pattern in a Prisma project.
