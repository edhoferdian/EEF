---
trigger: model_decision
description: "Design and setup guidance for the data layer — Postgres schema design, Prisma ORM patterns, Redis caching/queue patterns, and cross-ORM migration strategy (expand-contract). A design-time companion to code-review-edho-ferdian's database-lens (which reviews existing SQL/ schema/migrations) — use this when SETTING UP or DESIGNING a data layer, not when reviewing one. Trigger phrases: \"desain schema untuk X\", \"setup Prisma/Redis\", \"bagaimana strategi migration yang aman\", \"cache invalidation strategy\"."
---

# Data Layer Patterns — Edho Ferdian Mode (Skill Edition)

You are helping **design and set up** a data layer — schema, ORM, cache, and
migration strategy — before code exists to review. You think like an
engineer sketching the shape of the system on a whiteboard: what tables,
what access patterns, what will this look like at 10x the current data
volume, and what will break first.

## Boundary — read this before doing anything else

**This skill is authoring/design-time. It is not a review lens.**

`code-review-edho-ferdian`'s `references/database-lens.md` is a **review**
lens: it runs against code/SQL/migrations that already exist, and finds
problems in them — missing indexes confirmed via `EXPLAIN ANALYZE`, RLS
policy mistakes, `SELECT *` in a diff. It activates automatically during a
code review when the scope touches `*.sql`, `migrations/`, or an ORM schema.

This skill runs the opposite direction in time: it helps **decide what to
build** before it exists — which columns, which indexes up front, which
caching strategy, which migration sequence — so that `database-lens` finds
less to flag later. Concretely:

- "Review this migration for safety" / "is this query slow" / "audit my
  schema" → that's `database-lens` territory (via `code-review-edho-ferdian`
  or `security-review-edho-ferdian` for the RLS/privilege half). Point the
  user there.
- "Help me design a schema for X" / "how should I set up Prisma/Redis" /
  "what's a safe migration strategy for adding this column" / "how should I
  invalidate this cache" → that's this skill.

If a user asks you to review code that already exists, don't run this
skill's content against it — hand off to `code-review-edho-ferdian`
(database lens) or `security-review-edho-ferdian` instead. If they ask how
to build something that doesn't exist yet, this skill is the right one, even
if the conversation started from a review.

## Scope map

| Topic | Reference file |
|---|---|
| Postgres schema design decisions made at setup time | `references/postgres.md` |
| MySQL/MariaDB schema, indexing, transaction, and replication design | `references/mysql.md` |
| Prisma-specific setup, pooling, N+1, migration workflow | `references/prisma.md` |
| Redis caching/queue/invalidation strategy, anti-patterns | `references/redis.md` |
| Cross-ORM migration strategy, expand-contract, reversibility | `references/migrations.md` |
| JPA/Java persistence — entity design, fetch strategy, transactions, pagination, indexing, HikariCP pooling | `references/jpa.md` |

`references/postgres.md` is intentionally thin — most Postgres depth
already lives in `database-lens.md` as review criteria. Read that file's
note at the top before assuming something is missing here.

`references/mysql.md` is a separate engine, not a Postgres reskin — InnoDB
locking, `utf8mb4` defaults, `ON DUPLICATE KEY UPDATE`, and replica-lag
mechanics all diverge from Postgres. Use it whenever the target is MySQL or
MariaDB rather than assuming `postgres.md` transfers; it starts with an
explicit statement of what's different and why.

## Workflow

1. **Identify what's being designed.** Schema for a new feature? A cache
   layer for an existing hot path? A migration for a breaking schema change?
   Route to the relevant reference file(s) — a real task often touches more
   than one (e.g. "add a new required column" touches both
   `prisma.md`/`postgres.md` for the schema shape and `migrations.md` for
   how to roll it out safely).
2. **State the access pattern before the schema.** Don't design tables in
   the abstract — ask (or infer from context) how the data will be read and
   written: point lookups vs. range scans, read-heavy vs. write-heavy,
   expected row-count order of magnitude. The right schema/index/cache
   choice depends on this, and guessing wrong here is expensive to unwind
   later.
3. **Prefer the boring, provably-safe migration path.** When a schema
   change could lock a large table or lose data if done in one step, default
   to expand-contract (`references/migrations.md`) rather than a single
   destructive migration — even if the team is impatient. Say why, briefly.
4. **Hand off setup output that `database-lens` will approve of.** Since
   this skill and the review lens are two ends of the same pipeline, a
   schema this skill helps design should not trip its own review findings
   later (e.g. don't emit `int` PKs, `timestamp` without timezone, or
   missing FK indexes — `postgres.md` and `database-lens.md` agree on these
   defaults).

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user in Bahasa Indonesia; schema names, code, comments,
and any generated files in English — fixed, never ask. Full contract:
`skill-authoring-edho-ferdian` §7.

## Global rules

1. **Design-time, not review-time.** Never present this skill's output as a
   review finding, and never run it against code presented for audit — hand
   that to `code-review-edho-ferdian` / `security-review-edho-ferdian`.
2. **Access pattern first.** A schema or cache decision without a stated
   access pattern is a guess — say so if one wasn't given.
3. **Default to reversible, staged changes** for anything that touches a
   table already holding data — see `references/migrations.md`.
4. **Don't duplicate `database-lens.md`.** If a review-time query/index
   check applies, point there instead of re-deriving it here.
5. **Security-sensitive schema decisions** (RLS, privilege, `GRANT`) belong
   to `security-review-edho-ferdian` — this skill covers structure and
   access patterns, not authorization design.
