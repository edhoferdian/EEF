# MySQL / MariaDB — Design-Time Notes

Adapted from ECC `mysql-patterns`, fetched 2026-09-06.

## Not a copy of postgres.md — read this before assuming otherwise

This file looks like it could be `postgres.md` with table names swapped. It
is not, and treating it that way will produce wrong advice. MySQL/MariaDB and
Postgres diverge at the storage-engine level, not just in SQL dialect:

- **Locking model.** InnoDB uses gap locks and next-key locks on top of
  row locks to protect ranges under `REPEATABLE READ` — Postgres's MVCC has
  no equivalent, so a deadlock or lock-wait investigation that assumes
  Postgres semantics will misdiagnose a MySQL gap-lock stall.
- **Character set defaults.** MySQL's historical `utf8` alias is actually
  `utf8mb3` (3-byte, cannot store most emoji or many CJK extension
  characters) — a trap Postgres doesn't have, since Postgres `UTF8` is
  always full-width. Every MySQL/MariaDB table and index in this file
  assumes `utf8mb4`/`utf8mb4_unicode_ci` explicitly; never assume the
  server or database default is already correct.
- **Upsert syntax.** `ON DUPLICATE KEY UPDATE` is MySQL/MariaDB-only syntax
  with its own row-alias deprecation split (see Version Gate below) —
  it is not interchangeable with Postgres's `ON CONFLICT ... DO UPDATE`,
  and porting one syntax's mental model to the other produces broken SQL.
- **Replica lag characteristics.** MySQL/MariaDB replication (`SHOW [SLAVE
  \| REPLICA] STATUS`, SQL-thread vs IO-thread lag) is a different
  mechanism from Postgres streaming/logical replication and needs its own
  health checks — don't reuse a Postgres replica-lag runbook here.

Where a decision genuinely doesn't depend on the engine (e.g. "decide the
access pattern before the schema," "prefer expand-contract for risky
migrations"), it lives once in `SKILL.md` or `references/migrations.md` —
this file only carries what is different because the engine is MySQL/MariaDB.

## Version / engine gate — check this before applying anything below

Start every MySQL/MariaDB task by identifying the actual engine and version:

```sql
SELECT VERSION();
SHOW VARIABLES LIKE 'version_comment';
```

MySQL and MariaDB have diverged on several SQL details. Do not present one
syntax as universal:

- **MySQL** documents row aliases as the replacement for `VALUES(col)` in
  `ON DUPLICATE KEY UPDATE`; `VALUES(col)` is deprecated there.
- **MariaDB** still documents `VALUES(col)` as the supported way to
  reference inserted values in `ON DUPLICATE KEY UPDATE` — use it for
  cross-engine compatibility, or when the target fleet mixes MySQL and
  MariaDB.
- `SKIP LOCKED` is appropriate for queue-like work only, on either engine
  (see Transactions below).

## Schema defaults

```sql
CREATE TABLE orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    account_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(32) NOT NULL,
    total DECIMAL(15, 2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_orders_account_status_created (account_id, status, created_at),
    KEY idx_orders_active (account_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

| Use case | Prefer | Avoid |
|---|---|---|
| Surrogate primary keys | `BIGINT UNSIGNED AUTO_INCREMENT` | `INT` for tables that can grow beyond 2B rows |
| UUID lookup keys | `BINARY(16)` with conversion helpers | `VARCHAR(36)` as the primary key on a hot table |
| Money and exact quantities | `DECIMAL(p, s)` | `FLOAT` or `DOUBLE` |
| User-facing text | `utf8mb4` tables and indexes | MySQL's `utf8` / `utf8mb3` defaults (the classic emoji/4-byte trap) |
| Application timestamps | `DATETIME` with UTC managed by the application | Assuming `DATETIME` stores time-zone metadata — it does not |
| Soft deletes | `deleted_at DATETIME NULL` plus indexes that cover the soft-delete predicate | Filtering soft-deleted rows without an index behind it |
| Extensible status values | a lookup table, or a constrained `VARCHAR` | `ENUM` for values that change often — altering an `ENUM` is a schema change |

## Indexing

Composite index order follows equality predicates first, then range or sort
columns:

```sql
CREATE INDEX idx_orders_account_status_created
    ON orders (account_id, status, created_at);

SELECT id, total
FROM orders
WHERE account_id = ?
  AND status = 'pending'
  AND created_at >= ?
ORDER BY created_at DESC
LIMIT 50;
```

Check the plan before adding or changing an index:

```sql
EXPLAIN
SELECT id, total
FROM orders
WHERE account_id = 123 AND status = 'pending'
ORDER BY created_at DESC
LIMIT 50;
```

Risk signals in `EXPLAIN` output:

| Field | Risk signal |
|---|---|
| `type` | `ALL` on a large table |
| `key` | `NULL` when a selective predicate exists |
| `rows` | Very high row estimate for an interactive path |
| `Extra` | `Using temporary`, `Using filesort`, or a broad `Using where` |

Every index increases write cost, migration time, backup size, and
buffer-pool pressure — don't add one speculatively.

## Query patterns worth deciding up front

**Upsert.** The cross-engine-compatible form uses `VALUES(col)`:

```sql
INSERT INTO user_settings (user_id, setting_key, setting_value)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE
    setting_value = VALUES(setting_value),
    updated_at = CURRENT_TIMESTAMP;
```

The MySQL-only row-alias form (use only after confirming the target is
MySQL, not MariaDB):

```sql
INSERT INTO user_settings (user_id, setting_key, setting_value)
VALUES (?, ?, ?) AS new
ON DUPLICATE KEY UPDATE
    setting_value = new.setting_value,
    updated_at = CURRENT_TIMESTAMP;
```

**Keyset pagination** instead of deep `OFFSET` (which scans and discards
rows on large tables):

```sql
SELECT id, name, created_at
FROM products
WHERE (created_at, id) < (?, ?)
ORDER BY created_at DESC, id DESC
LIMIT 50;

CREATE INDEX idx_products_created_id ON products (created_at, id);
```

**JSON columns** for extension data only, not for fields needing heavy
relational filtering or constraints. Expose a frequently queried path as a
generated column and index that column; keep foreign keys, ownership,
tenancy, and lifecycle fields relational:

```sql
CREATE TABLE events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payload JSON NOT NULL,
    event_type VARCHAR(64)
        GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.type'))) STORED,
    KEY idx_events_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Full-text search** via `FULLTEXT` index for basic natural-language
ranking; reach for external search (Elasticsearch/Meilisearch/etc.) when you
need typo tolerance, complex ranking, cross-table facets, or
language-specific analysis:

```sql
ALTER TABLE articles ADD FULLTEXT KEY ft_articles_title_body (title, body);

SELECT id, title, MATCH(title, body) AGAINST (? IN NATURAL LANGUAGE MODE) AS score
FROM articles
WHERE MATCH(title, body) AGAINST (? IN NATURAL LANGUAGE MODE)
ORDER BY score DESC
LIMIT 20;
```

## Transactions and deadlocks

Keep transactions short and lock rows in a deterministic order across every
code path that touches them:

```sql
START TRANSACTION;

SELECT id, balance
FROM accounts
WHERE id IN (?, ?)
ORDER BY id
FOR UPDATE;

UPDATE accounts SET balance = balance - ? WHERE id = ?;
UPDATE accounts SET balance = balance + ? WHERE id = ?;

COMMIT;
```

Deadlock and lock-wait checklist:

- Lock rows in the same order every time, across every code path.
- Do external API calls **before** `START TRANSACTION`, never inside the
  transaction — an external call inside a transaction holds locks for the
  duration of a network round trip.
- Add indexes for predicates used in `UPDATE`, `DELETE`, and locking reads
  (`SELECT ... FOR UPDATE`) — an unindexed predicate escalates gap locks
  over a much wider range than the query logically needs.
- On deadlock, roll back and retry the whole transaction with a bounded
  retry budget — don't retry unboundedly.
- Capture `SHOW ENGINE INNODB STATUS\G` **immediately** after a deadlock —
  the deadlock detail is overwritten by later events, so a delayed capture
  gets you nothing.

Queue-style worker claim — `FOR UPDATE SKIP LOCKED` is for queue workloads
only, where skipping a locked row is an acceptable trade-off. It is not a
substitute for normal transactional consistency in accounting or
integrity-sensitive paths:

```sql
START TRANSACTION;

SELECT id
FROM jobs
WHERE status = 'pending'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;

UPDATE jobs
SET status = 'processing', started_at = CURRENT_TIMESTAMP
WHERE id = ?;

COMMIT;
```

## Connection pools

Keep `pool_recycle` **below** the server's `wait_timeout`, and pair it with
`pool_pre_ping` — otherwise the pool hands out connections the server has
already closed, and the first query on a stale connection fails.

```python
from sqlalchemy import create_engine

engine = create_engine(
    "mysql+mysqlconnector://app:secret@db.internal/app",
    pool_size=10,
    max_overflow=5,
    pool_timeout=30,
    pool_recycle=240,      # below server wait_timeout (e.g. 300)
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5},
)
```

```javascript
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
});
```

If the server uses `wait_timeout = 300`, a `pool_recycle` around 240 seconds
is coherent; `pool_pre_ping` still helps recover from network blips and
failover events that happen inside that window.

## Replica lag

Do not route read-after-write paths, checkout flows, permission checks, or
idempotency-key reads to a replica — a lagging replica silently serves stale
state on exactly the paths where staleness causes real bugs.

```sql
-- MySQL legacy terminology, still common in existing fleets
SHOW SLAVE STATUS\G;

-- Newer terminology where supported
SHOW REPLICA STATUS\G;
```

Check the engine/version before standardizing on one command (see Version
Gate above). Monitor SQL-thread health, IO-thread health, and lag itself —
not just whether the TCP connection to the replica is alive; a replica can
hold an open connection while its SQL thread is stalled.

## Security — pointer only, not duplicated here

Don't re-derive MySQL privilege/hardening rules in this file. They are
instances of the least-privilege principle already codified as SEC-04 in
`security-review-edho-ferdian`, and belong there so there's one place to
keep them current. What SEC-04 covers for MySQL/MariaDB specifically:

- Never grant `ALL PRIVILEGES` or `*.*` to an application user.
- `REQUIRE SSL` (or the modern `REQUIRE X509`/TLS equivalent) for
  application users whose traffic crosses hosts or networks.
- Remove anonymous users (`''@'localhost'`, `''@'%'`) — they're a classic
  MySQL default-install leftover, not something a fresh install auto-cleans.
- Separate the migration/admin user from the runtime application user, so a
  compromised app credential can't run DDL or touch `mysql.user` directly.

If you're designing a MySQL schema and hit one of these, point to
`security-review-edho-ferdian` rather than answering it inline here.

## Configuration — treat as a review prompt, not a preset

The block below is a **starting point to review against actual workload,
hardware, backup policy, and recovery objectives** — not a copy-paste
preset. `innodb_buffer_pool_size = 4G` is a reasonable planning number for a
dedicated database host with the memory to spare; the same value on a small
VPS with 2-4G total RAM will starve the OS and every other process on the
box. Size every value below from the real constraints of the box it runs
on, not from this example:

```ini
[mysqld]
innodb_buffer_pool_size = 4G
innodb_flush_log_at_trx_commit = 1
sync_binlog = 1

max_connections = 300
thread_cache_size = 50

wait_timeout = 300
interactive_timeout = 300
innodb_lock_wait_timeout = 10

slow_query_log = ON
long_query_time = 1
log_queries_not_using_indexes = ON

log_bin = mysql-bin
binlog_format = ROW
binlog_expire_logs_seconds = 604800
```

## Anti-patterns

| Anti-pattern | Risk | Better pattern |
|---|---|---|
| `SELECT *` in hot paths | Over-fetching and brittle clients | Select explicit columns |
| Deep `OFFSET` pagination | Linear scans and slow pages | Keyset pagination |
| No index on foreign-key joins | Slow joins and lock-heavy deletes | Index FK columns intentionally |
| Long transactions | Lock waits and large undo history | Commit small units of work |
| Direct DML against `mysql.user` | Grant-table corruption risk | Use `CREATE USER`, `ALTER USER`, `DROP USER` |
| Application user with admin grants | High blast radius | Least-privilege runtime user (SEC-04) |
| Pool recycle above `wait_timeout` | Stale pooled connections | Recycle below timeout and pre-ping |
| Replica reads immediately after writes | Stale user-facing state | Pin read-after-write flows to primary |

## Diagnostics quick reference

```sql
SHOW FULL PROCESSLIST;
SHOW ENGINE INNODB STATUS\G;
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';
```

Enable the slow log in a controlled environment only:

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;
SET GLOBAL log_queries_not_using_indexes = 'ON';
```

`EXPLAIN ANALYZE` actually executes the statement — only run it when doing
so on production-sized data is safe.
