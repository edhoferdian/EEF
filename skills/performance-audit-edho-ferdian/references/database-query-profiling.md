# Database query profiling — the dynamic half

Companion to `code-review-edho-ferdian/references/database-lens.md`. That
file owns the **static** half of database reasoning — schema/index design
read without running anything, confidence-capped unless backed by real
`EXPLAIN ANALYZE`/`pg_stat_*` output. This file is what backs that
requirement: the dynamic half — reading a query plan in depth, tracking plan
regressions over time, working a slow-query log, and diagnosing connection-
pool saturation. Same measure-then-fix discipline as the rest of this skill:
a plan you haven't actually run is a hypothesis, not a finding.

Cross-reference, don't duplicate: schema/index *design* correctness
(composite index ordering, missing FK indexes, type choices, `SELECT *`,
OFFSET pagination, table bloat, `statement_timeout`) stays in
`database-lens.md`. This file assumes a query already exists and is slow (or
suspected slow) in a running system, and its job is to prove *why* with a
plan, a log, or a pool metric.

---

## Reading `EXPLAIN ANALYZE` output in depth

Run the real thing, not `EXPLAIN` alone — `EXPLAIN ANALYZE` actually executes
the query and reports real timings and row counts, which is the only way to
catch a planner misestimate:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) <query>;
```

`BUFFERS` is not optional — without it you only see time, not whether that
time was spent on disk I/O (cold cache) or CPU (hot cache), which changes the
fix entirely.

### The fields that matter, in the order to check them

1. **Actual vs. estimated rows** — every plan node reports both
   (`rows=120000 ... actual rows=4`). A large gap between estimate and
   actual is the single strongest signal that the planner chose a bad plan:
   stale statistics (`ANALYZE <table>` hasn't run recently), a skewed
   column the planner's default statistics target under-samples, or a
   correlated-condition query the planner can't reason about (multiple
   `WHERE` clauses on columns that are not actually independent). Fix
   direction: `ANALYZE` the table, raise `default_statistics_target` for
   the skewed column, or add an extended statistics object
   (`CREATE STATISTICS`) for the correlated columns — in that order of
   cost.
2. **Node type at the bottom of the plan tree** — read bottom-up, since
   each node's output feeds the one above it:
   - `Seq Scan` on a table above trivial size with a selective `WHERE` is
     the classic missing-index signal — but only a finding if `BUFFERS`
     shows real page reads, and only High confidence if this query runs on
     a hot path (see `database-lens.md` PERF-07a for the static half of
     this check).
   - `Index Scan` vs `Index Only Scan` — an Index Only Scan skips the heap
     fetch entirely (needs a covering index or `INCLUDE` columns, visibility
     map permitting); an Index Scan that then does a heavy `Heap Fetches`
     count in `BUFFERS` output suggests a covering index would pay off.
   - `Bitmap Heap Scan` + `Bitmap Index Scan` pair — normal for a
     moderately selective condition; if `Heap Blocks: exact` is much smaller
     than `Heap Blocks: lossy`, `work_mem` is too small for the bitmap and
     is falling back to a lossy (page-level, not row-level) representation.
3. **Join strategy** — `Nested Loop` is fine (and often fastest) when the
   outer side is small; it becomes the bottleneck when the outer side's
   *actual* row count is large and the inner side has no supporting index
   (watch for `Nested Loop` directly above a `Seq Scan` inner node — that
   combination is O(n×m) in practice). `Hash Join` needs `work_mem` to hold
   the build side in memory — check for `Hash ... Batches: N` where N > 1,
   which means the hash table spilled to disk and the join is now
   I/O-bound. `Merge Join` requires sorted inputs; a `Sort` node feeding it
   that isn't backed by an index is a candidate for adding one to avoid the
   sort entirely.
4. **Sort/Aggregate memory** — a `Sort` node reporting
   `Sort Method: external merge  Disk: 45000kB` spilled to disk because
   `work_mem` was too small for that sort; a `Sort Method: quicksort`
   staying in memory is fine. Raising `work_mem` (session-level for a
   specific heavy query, not globally — it's per-sort-operation memory and
   multiplies with concurrency) is the direct fix; only necessary if the
   spilling sort is actually on a hot path.
5. **Total cost vs. actual time** — the planner's cost estimate (arbitrary
   units) and the actual time (real milliseconds) can diverge in either
   direction. Trust actual time for a decision on whether a query is slow;
   trust the estimate-vs-actual row gap (point 1) for a decision on why.

### A worked example

```
Nested Loop  (cost=0.43..847.21 rows=1 width=64) (actual time=0.052..312.884 rows=8400 loops=1)
  ->  Seq Scan on orders o  (cost=0.00..820.00 rows=1 width=40) (actual time=0.021..45.112 rows=8400 loops=1)
        Filter: (status = 'pending'::text)
        Rows Removed by Filter: 91600
  ->  Index Scan using orders_user_id_idx on users u  (cost=0.43..8.45 rows=1 width=24) (actual time=0.003..0.004 rows=1 loops=8400)
Planning Time: 0.412 ms
Execution Time: 314.220 ms
```

Reading order: the planner estimated 1 row from the `orders` filter and got
8,400 — a 4-order-of-magnitude misestimate, meaning `orders`' statistics on
`status` are stale or the value distribution is skewed enough that default
sampling misses it. That misestimate is *why* the planner chose a Nested
Loop (correct for 1 row, catastrophic for 8,400) instead of a Hash Join. The
inner Index Scan running 8,400 times at ~0.004ms each is itself fine — the
314ms total is almost entirely the outer Seq Scan cost multiplied by loop
count feeding a Nested Loop that shouldn't have been chosen. Fix candidates,
cheapest first: `ANALYZE orders;` (may fix the estimate and let the planner
pick Hash Join on its own), then a partial index on
`orders (status) WHERE status = 'pending'` if `pending` is a small,
persistently hot subset.

---

## Query plan history and regression detection

A single `EXPLAIN ANALYZE` is a snapshot — it tells you nothing about
whether *this* plan is new. A query that was fast last week and is slow
today usually didn't get slower code; it got a **different plan** because
data volume, statistics, or a parameter value crossed a planner threshold.

### Detecting a plan flip without a dedicated tool

- `pg_stat_statements` tracks `calls`, `mean_exec_time`, `stddev_exec_time`,
  and `rows` per normalized query — a rising `stddev_exec_time` relative to
  `mean_exec_time` on a query whose text hasn't changed is the signature of
  **parameter-sensitive plan flipping**: the same query text executes fast
  with common parameter values and catastrophically with a rare one (or vice
  versa), because the planner picked one plan for all of them.
  ```sql
  SELECT query, calls, mean_exec_time, stddev_exec_time, rows
  FROM pg_stat_statements
  WHERE stddev_exec_time > mean_exec_time
  ORDER BY calls * mean_exec_time DESC
  LIMIT 20;
  ```
- Persist `EXPLAIN (ANALYZE, FORMAT JSON)` output for the top N queries by
  total time to a file per audit run, the same way this skill's Baselines
  section persists benchmark JSON — a plan diff (join order changed, an
  index that was being used no longer appears) is direct evidence of a
  regression, not a guess from "it feels slower."
- If `pg_stat_statements.max` resets on a deploy or a `pg_stat_statements_reset()`
  call, the history window is gone — note this explicitly rather than
  reporting on partial history as if it covered the full period being
  investigated.
- A managed Postgres provider (RDS Performance Insights, Supabase's query
  performance dashboard, Cloud SQL Insights) usually keeps this history
  automatically — check what's available in Phase 0 before reasoning from
  `pg_stat_statements` alone, since a provider dashboard often has longer
  retention and pre-aggregated percentiles.

### Common causes of a plan regression, ranked by frequency

1. **Stale statistics after a bulk load/delete** — `autovacuum` runs
   `ANALYZE` on a threshold of *changed* rows, not wall-clock time; a bulk
   operation right before the regression is the first thing to check.
2. **Data volume crossed a planner threshold** — a table that grew past the
   point where a Seq Scan is cheaper than a Nested Loop with many index
   probes (this is data-dependent, not a fixed row count).
3. **A parameter value outside the sampled distribution** — see the
   `stddev_exec_time` signature above.
4. **An index was dropped or became invalid** (a `CREATE INDEX CONCURRENTLY`
   that failed partway leaves an `INVALID` index that the planner ignores).
5. **A Postgres version upgrade changed planner defaults** — check the
   release notes for planner-relevant GUC default changes before assuming
   the query itself is the problem.

---

## Slow-query log analysis workflow

`pg_stat_statements` answers "which queries are slow on average"; the slow-
query log answers "show me the actual slow executions, with their actual
parameter values and timing" — use both, they catch different things.

### Enabling and reading the log

```
log_min_duration_statement = 200   # ms — log anything slower than this
log_line_prefix = '%m [%p] user=%u,db=%d,app=%a '
```

Setting `log_min_duration_statement` too low (e.g. `0`) on a busy production
system generates enough log volume to become its own I/O problem — start at
a threshold above your SLA (e.g. 200ms for a 100ms p95 target) and lower it
only for a bounded investigation window.

### Workflow

1. **Aggregate before reading line-by-line.** Use `pgbadger` or
   `pg_stat_statements` to normalize and rank slow-log entries by total time
   (frequency × duration) — a query that runs 10,000 times at 50ms costs
   more than one that runs once at 2s, and reading raw log lines in
   chronological order won't surface that.
2. **Correlate timestamps with deploys and traffic shape.** A cluster of
   slow entries starting at a specific minute usually maps to a deploy, a
   cron job, a batch import, or a traffic spike — check what changed at that
   timestamp before assuming the query itself regressed.
3. **Pull the actual parameter values from slow entries**, not just the
   normalized query shape — `pg_stat_statements` shows `$1`-style
   placeholders; the raw log line (with `log_min_duration_statement`) shows
   the literal value that was slow, which is what you feed back into
   `EXPLAIN ANALYZE` to reproduce it.
4. **Separate app-side slow queries from maintenance/replication queries** —
   an `autovacuum` worker, `pg_dump`, or a logical-replication apply process
   can dominate a slow-query log without being a query-authoring problem at
   all.

---

## Connection-pool saturation

A connection pool (PgBouncer, RDS Proxy, application-level pool like
`node-postgres`'s `Pool` or SQLAlchemy's `QueuePool`) sitting at or near its
max size produces symptoms that look like generic slowness but have a
completely different fix than an unindexed query.

### Symptoms that point at the pool, not the query

- Request latency has a **bimodal distribution** — most requests are fast,
  a subset are exactly as slow as the pool's checkout timeout. A query-level
  slowdown produces a shifted distribution, not a bimodal one; a pool
  problem produces a spike at the timeout value because those requests
  weren't running a slow query at all, they were queued waiting for a
  connection.
- Application-level pool metrics (exposed by most pool libraries) show
  `waiting` or `pending` count > 0 sustained, not just momentary — a
  transient blip under a load spike is expected; a sustained queue means
  the pool is undersized for the actual concurrent demand.
- Database-side, active connections sit at `max_connections` (or the pool's
  configured max) with a nontrivial share `idle in transaction`:
  ```sql
  SELECT state, count(*) FROM pg_stat_activity GROUP BY state ORDER BY count(*) DESC;
  ```
  A high `idle in transaction` count is not "the pool is too small" — it's
  a connection being held open by application code that started a
  transaction and never committed/rolled back promptly (a missing
  `statement_timeout`/`idle_in_transaction_session_timeout`, per
  `database-lens.md` PERF-07h). Sizing the pool up in this case just holds
  more connections idle-in-transaction — it doesn't fix the leak.

### Diagnosing exhaustion vs. undersizing vs. leak

1. **Check `idle in transaction` first** (query above). If it's
   nontrivial, this is a leak/timeout problem in application code or a
   missing DB-side timeout, not a pool-sizing problem — fix that before
   touching pool size.
2. **If connections are `active`, not idle**, check whether they're active
   on genuinely slow queries (cross-reference `pg_stat_activity.query`
   against the slow-query findings above) — a pool exhausted by real work
   needs either faster queries or more capacity, not a pool-size band-aid.
3. **Only after ruling out 1 and 2**, consider pool sizing. The common
   mistake is sizing the pool to the number of application server threads/
   workers rather than to what the database can actually sustain
   concurrently — Postgres connections are relatively heavyweight (each is
   a full backend process), and a pool sized far above what the database's
   `max_connections` and available memory support causes context-switching
   overhead that makes things worse, not better. A connection pooler in
   transaction-pooling mode (PgBouncer) in front of Postgres, sized well
   below `max_connections`, usually outperforms a large per-app-instance
   pool talking directly to Postgres.
4. **Confirm the fix by re-measuring the `waiting`/`pending` pool metric**
   under the same load, the same way any other fix in this skill gets
   re-measured in Phase 4 — a pool-size change that doesn't move sustained
   queue depth to zero didn't fix the actual constraint.

---

## N+1 detection at runtime (vs. static detection)

`code-review-edho-ferdian` PERF-01 flags an N+1 **statically** — a query
call sitting inside a loop, read from the source. That's a suspicion, not a
finding: the loop might run once, or the ORM might already be batching under
the hood. This section is how to confirm (or refute) it dynamically, which
is this skill's job per the SKILL.md's own scope note.

1. **Turn on query logging for a single request/action**, not the whole
   session — most ORMs support a per-request query log or a debug toolbar
   (Django Debug Toolbar, Rails' `bin/rails log`, a Prisma/TypeORM query
   log hook). Count the actual number of queries issued for one logical
   action (e.g. "render this list page").
2. **The confirming signature**: query count scales linearly with a result
   set size the request controls (10 items → 11 queries, 100 items → 101
   queries) rather than staying constant. A constant query count regardless
   of result size means the suspected N+1 was already resolved by eager
   loading/joins/batching — the static suspicion was a false positive, and
   that should be reported as such rather than silently dropped.
3. **Distinguish N+1 from a legitimately-per-item operation** — a loop that
   calls an external API or does per-item compute isn't a database N+1 even
   if it looks structurally similar; the fix (batching, caching, a
   different API) is different from "add a join" or "use `.select_related()`/
   `.includes()`/`prefetch`".
4. **Fix verification**: after adding eager loading/batching, re-run the
   same per-request query count measurement — the fix is confirmed only
   when the count becomes constant (or drops to the theoretical minimum:
   1 query for the list + 1 for the batched related data, not N+1 → 2), not
   when it merely feels faster.

---

## Provenance

Written for this ecosystem to close the database query profiling gap,
2026-09-07.
