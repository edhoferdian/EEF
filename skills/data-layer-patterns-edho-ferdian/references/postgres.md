# Postgres — Design-Time Notes

**This file is deliberately thin.** Most Postgres content that matters —
data type choices, index cheat sheets, composite index ordering, RLS policy
form, anti-pattern detection queries — already lives as **review criteria**
in `code-review-edho-ferdian/references/database-lens.md` (PERF-07a..f) and
`security-review-edho-ferdian/references/domain-specific.md` §Database
(SEC-04a..d). Read those before this file if you want the full checklist —
they're the source of truth for "is this schema correct," and duplicating
them here would just create two copies to keep in sync.

What follows is content that's genuinely **design-time** — decisions made
once, at setup, before there's anything to review.

## Normalized vs. denormalized: decide from the access pattern, not habit

Default to normalized (3NF-ish) unless a specific, known read pattern
justifies denormalizing. The tell that denormalization is warranted:

- A read path that would otherwise require joining 3+ tables on every
  request, and that path is hot (called far more often than the data is
  written).
- The joined data changes rarely relative to how often it's read (e.g. a
  product's category name, a user's display name embedded on their own
  posts) — so keeping a denormalized copy in sync is cheap.
- You've already measured (or can reasonably predict) that the join is the
  bottleneck — don't denormalize speculatively before there's a hot path to
  justify it (YAGNI applies to schema too).

When you do denormalize, decide up front how the copy stays in sync:
application-level write-through, a database trigger, or an async job — and
write that decision down next to the schema, because it's invisible in the
schema itself and the next engineer needs to know it's not just stale data.

## Materialized views: when to reach for one

Use a materialized view when:

- The underlying query is expensive (multiple joins, aggregations over a
  large table) and doesn't need to reflect writes in real time.
- The same expensive query is run often enough that recomputing it per
  request is wasteful (a dashboard, a leaderboard, a reporting page).
- You can define an acceptable staleness window and a refresh strategy
  (`REFRESH MATERIALIZED VIEW CONCURRENTLY` on a schedule, or triggered
  after a batch job) — a materialized view with no refresh plan is a stale
  cache nobody's watching.

Don't reach for one when a regular index would fix the query, or when the
data must be real-time (materialized views are a caching decision, not a
correctness one — pair with `references/redis.md` if the real need is
"cache this expensive read," since Redis may be the simpler tool for a
per-request rather than per-report cache).

## Choosing a primary key strategy at setup time

This is a design-time decision because it's expensive to change later
(re-keying a live table with foreign keys pointing at it is a migration
project, not a column edit):

- Sequential `bigint` (`GENERATED ALWAYS AS IDENTITY`) — best index
  locality, but leaks row count/creation order if exposed externally.
- UUIDv7 or a sortable ID (e.g. ULID, or Prisma's `cuid()` — see
  `references/prisma.md`) — external-safe, still roughly time-ordered so it
  doesn't fragment the B-tree the way a random UUIDv4 does.
- Random UUIDv4 — only when interoperating with an external system that
  requires it; accept the index fragmentation cost knowingly, don't default
  into it.

Decide this before the table has real rows in production — see
`references/migrations.md` for what it costs to change a PK strategy later.

## Menandai kolom sensitif di level skema

SEC-06 (`security-review-edho-ferdian`) melarang data sensitif bocor ke URL,
log, atau klien yang tidak membutuhkannya. Aturan itu hanya bisa ditegakkan
kalau "mana yang sensitif" adalah fakta yang bisa dibaca mesin, bukan sesuatu
yang harus diingat reviewer per kolom.

Postgres sudah menyediakan tempatnya secara gratis:

```sql
COMMENT ON COLUMN users.email         IS 'PII: email';
COMMENT ON COLUMN users.phone         IS 'PII: phone';
COMMENT ON COLUMN payouts.amount      IS 'PII: financial';
COMMENT ON COLUMN patients.national_id IS 'PHI: national_id';
```

Lalu inventaris permukaan sensitif jadi satu query, bukan pembacaan manual:

```sql
SELECT c.table_name, c.column_name,
       col_description(format('%I.%I', c.table_schema, c.table_name)::regclass,
                       c.ordinal_position) AS tag
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND col_description(format('%I.%I', c.table_schema, c.table_name)::regclass,
                      c.ordinal_position) LIKE ANY (ARRAY['PII:%','PHI:%']);
```

**Kenapa ini berguna di luar compliance.** Daftar itu jadi input konkret untuk
tiga hal yang selama ini dikerjakan dari ingatan: kolom mana yang tidak boleh
masuk `SELECT *` yang mengalir ke respons API, kolom mana yang harus
diredaksi sebelum sebuah dump dipakai sebagai data seed/staging, dan kolom
mana yang butuh RLS ketat. Tag hidup bersama skema, jadi ikut terbawa migrasi
alih-alih basi di dokumen terpisah — bandingkan dengan
`docs-sync-edho-ferdian` yang menangani kasus di mana dokumentasi *tidak*
hidup bersama kodenya.

**Batas jujur.** Ini konvensi, bukan penegakan: Postgres tidak akan menolak
query karena sebuah kolom bertag. Nilainya adalah keterlihatan (dan
kemungkinan sebuah check CI yang memfailkan skema baru dengan kolom bernama
mirip-PII tanpa tag). Jangan tulis atau baca ini seolah-olah kontrol akses.
