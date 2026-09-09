# Conditional Lens — Database

This lens draws on content originally credited to Supabase.

**Activation.** This lens runs only when Phase 0 detects the review scope
touches `*.sql` files, a `migrations/` directory, an ORM schema (Prisma
schema, SQLAlchemy/Django models, TypeORM/Sequelize entities, etc.), or a
`supabase/` directory. If none of those are in scope, skip this file
entirely — don't report "N/A" for it in the final review.

**Code placement.** This lens does not open a new domain. Query/schema/index
findings land as **PERF-07a..f** (owned by this file). Security/RLS/
concurrency findings land as **SEC-04a..d**, whose full criteria now live in
`security-review-edho-ferdian/references/domain-specific.md` §Database — load
that file (or delegate to the skill directly) when reviewing security, not
this file's now-slimmer SEC-04a..d pointer below. This keeps the severity
system and report format identical to the rest of the skill — the lens only
adds detection depth for a specific technology.

**Ground-truth requirement (stricter than the general Phase 2 rule).** Do not
label any index-related finding **[High confidence]** without actual
`EXPLAIN ANALYZE` or `pg_stat_user_indexes` output backing it. Reading a query
and guessing it "should" use an index is reasoning, not verification — cap
those at **[Medium confidence]** and say what command would confirm it, e.g.:

```
psql $DATABASE_URL -c "EXPLAIN ANALYZE <query>;"
psql $DATABASE_URL -c "SELECT indexrelname, idx_scan, idx_tup_read FROM pg_stat_user_indexes ORDER BY idx_scan DESC;"
psql $DATABASE_URL -c "SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

Run these when the repo has a reachable `DATABASE_URL` / dev database; if not
reachable, say so and keep the finding at Medium/Low confidence.

---

## PERF-07a..f — Query performance & schema design

- **PERF-07a Missing index on WHERE/JOIN columns** — confirmed via
  `EXPLAIN ANALYZE` showing a Seq Scan on a table large enough to matter.
- **PERF-07b Composite index column ordering** — equality-filtered columns
  should come before range-filtered columns in a composite index; a
  misordered composite index won't be used efficiently even though it exists.
- **PERF-07c `SELECT *` in production code** — pulls unnecessary columns,
  defeats covering indexes, and breaks silently on schema changes.
- **PERF-07d OFFSET pagination on large tables** — `OFFSET` cost grows
  linearly with page depth; flag in favor of cursor pagination
  (`WHERE id > $last ORDER BY id LIMIT $n`).
- **PERF-07e Schema type choices** — `int` for IDs where `bigint` is
  warranted, `timestamp` without timezone (should be `timestamptz`),
  `varchar(255)` without a real length reason (use `text`), random UUIDs as
  PKs where a sequential/UUIDv7 scheme would avoid index fragmentation.
- **PERF-07f Missing FK indexes / missing partial indexes** — foreign key
  columns without a supporting index (join and cascade-delete cost); soft
  deletes (`deleted_at`) without a partial index (`WHERE deleted_at IS
  NULL`) on the common "active rows" query pattern.
- **PERF-07g Table bloat / missed VACUUM** — confirm via `pg_stat_user_tables`,
  not just a hunch:

  ```sql
  SELECT relname, n_dead_tup, last_vacuum
  FROM pg_stat_user_tables
  WHERE n_dead_tup > 1000
  ORDER BY n_dead_tup DESC;
  ```

  A high `n_dead_tup` with no recent `last_vacuum` on a table taking regular
  writes means autovacuum isn't keeping up — flag it before it degrades
  every query against that table, not after.
- **PERF-07h Missing `statement_timeout` / `idle_in_transaction_session_timeout`**
  — these two are required connection-level defaults, not optional hardening:
  without them, a single
  runaway query or a connection left idle mid-transaction can hold a
  connection-pool slot indefinitely and starve every other request. Their
  absence is a finding on its own, independent of any specific slow query
  observed:

  ```sql
  ALTER SYSTEM SET statement_timeout = '30s';
  ALTER SYSTEM SET idle_in_transaction_session_timeout = '30s';
  ```

  (Values are illustrative — the right timeout depends on the workload; the
  finding is the *absence* of any bound, not the specific number chosen.)
- **PERF-07i Covering index (`INCLUDE`) opportunity** — distinct from
  PERF-07b's ordering concern: adding non-key columns to an index via
  `INCLUDE` lets a query that
  only reads those columns alongside the indexed ones satisfy entirely from
  the index (an index-only scan), skipping the heap fetch:

  ```sql
  CREATE INDEX idx ON users (email) INCLUDE (name, created_at);
  -- satisfies: SELECT email, name, created_at FROM users WHERE email = $1
  -- without a heap lookup
  ```

  Flag as an optimization opportunity (not a defect) when a hot,
  read-heavy query repeatedly selects the same small set of non-indexed
  columns alongside an already-indexed lookup column.

## SEC-04a..d — RLS, privilege, and concurrency

**Migrated to `security-review-edho-ferdian`.** RLS policy patterns
(`auth.uid()` wrapper, index coverage), least-privilege/`GRANT ALL`, and
queue/lock concurrency findings now live in `security-review-edho-ferdian/
references/domain-specific.md` §Database — load that file (or delegate to
the skill directly) when a security-sensitive database finding needs
SEC-04a..d depth. This file keeps only the query-performance/schema half
(PERF-07a..f above).

---

## Anti-pattern quick list (from the source agent)

Treat a hit on any of these as a strong prior even before running
`EXPLAIN ANALYZE` — but still confirm before labeling High confidence:

- `SELECT *` in application code paths (not ad-hoc debugging queries).
- `int`/`serial` for primary keys on tables expected to grow large.
- `timestamp` (no timezone) instead of `timestamptz`.
- Unparameterized query construction (this overlaps SEC-04's SQL injection
  check in the main checklist — don't double-count, cross-reference instead).
- `GRANT ALL` to an application-facing role.
- An RLS policy calling a function directly instead of wrapping it in
  `(SELECT ...)`.
- Batch work done as individual `INSERT`s in a loop instead of a multi-row
  `INSERT` or `COPY`.

---

## Severity guidance (PERF-07a..f — query performance & schema)

- 🟠 **HIGH** — confirmed missing index causing a Seq Scan on a
  user-facing hot path; `statement_timeout`/`idle_in_transaction_session_timeout`
  missing entirely at the connection level (PERF-07h) — an unbounded query or
  idle transaction can starve the whole pool, not just one request.
- 🟡 **MEDIUM** — schema type choices that will cause pain later (`int` IDs,
  `timestamp` without timezone) but aren't causing an incident today; OFFSET
  pagination on a table that isn't yet large enough to hurt; confirmed table
  bloat (PERF-07g) on a table not yet on a user-facing hot path.
- 🔵 **LOW** — `SELECT *` on a low-traffic internal path; missing covering
  index (PERF-07f/i) that would help but isn't blocking anything.
- ⚪ **INFO** — a Medium-confidence index suspicion you couldn't verify
  because the database wasn't reachable — report it, but label accordingly.

**Security severity guidance (RLS missing entirely, `GRANT ALL`, per-row
`auth.uid()`, confirmed race conditions)** now lives in
`security-review-edho-ferdian/references/domain-specific.md` §Database
alongside SEC-04a..d — see that file rather than this one.
