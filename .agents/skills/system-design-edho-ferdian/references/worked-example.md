# Worked Example — from question to ADR

One decision taken through the workflow end to end, so the steps in
SKILL.md have a concrete shape. Numbers are illustrative; in a real task
every current-state claim comes from the code or the user (Step 1).

## The ask

"Notifikasi WhatsApp untuk pesanan sekarang dikirim langsung di request
checkout. Kadang checkout jadi lambat dan kalau API WA error, pesanan
gagal. Perlu queue gak?"

## Step 1 — ground the current state

Evidence gathered (file:line in the real report):

- `POST /checkout` calls `sendWhatsApp()` synchronously after the DB
  commit (`src/routes/checkout.ts:88`).
- `sendWhatsApp` has a 10 s timeout and no retry (`src/lib/wa.ts:14`).
- Errors from it bubble up → the handler returns 500 even though the order
  was saved.
- Volume (user-supplied): ~2,000 orders/day, peaks of ~40 orders/minute
  during promos.
- Infra: one VPS, Postgres, Redis already used for sessions.

## Step 2 — requirements

| Type | Requirement |
|---|---|
| Functional | Customer receives an order confirmation on WhatsApp |
| Functional | A failed message is retried and visible to staff |
| NFR | Checkout p95 < 800 ms regardless of WA latency |
| NFR | No order fails because of a notification failure |
| NFR | Messages not sent twice for one order |
| Constraint | One VPS, small team; avoid new managed services |

## Step 3 — options and trade-offs

| | A. Keep sync, add retry | B. Postgres outbox + worker | C. Redis queue (BullMQ) | D. Managed queue (SQS/PubSub) |
|---|---|---|---|---|
| Checkout latency | Still bound to WA | Independent | Independent | Independent |
| Lost message if crash after commit | Yes | **No** (outbox row in same transaction) | Possible (commit then enqueue) | Possible |
| Duplicates | Retry may double-send | Idempotent by order id | Needs job id = order id | Needs dedupe |
| New infra | None | Worker process | Worker + Redis persistence config | New service, credentials |
| Ops visibility | Logs only | SQL table of pending/failed | Bull dashboard | Cloud console |
| Effort | 0.5 d | 2 d | 1.5 d | 3 d |

Decision drivers ranked: no lost/duplicate messages > checkout latency >
low ops burden.

## Step 4 — NFRs and scaling tiers

Capacity check: 40 orders/min peak = 0.67 msg/s. A single worker sending
one message per ~300 ms handles ~3 msg/s → 4.5× headroom.

| Tier | Load | Design holds? | Next step when exceeded |
|---|---|---|---|
| Now | 2k/day, 0.7 msg/s peak | Yes, 1 worker | — |
| 10× | 20k/day, 7 msg/s peak | 3 workers with `FOR UPDATE SKIP LOCKED` | — |
| 100× | 200k/day | Outbox table grows fast; WA rate limits bind | Partition/archive outbox, consider a broker |

Blast radius if the worker dies: notifications delay; checkout unaffected.
Alert on "oldest pending outbox row > 5 min".

## Step 5 — the ADR

```markdown
# ADR-012: Send order notifications through a transactional outbox

Status: Accepted (2026-11-19)
Deciders: Edho
Supersedes: —

## Context
Checkout sends WhatsApp synchronously (src/routes/checkout.ts:88). WA latency
and errors make checkout slow and fail orders that were already saved.
~2k orders/day, peak 40/min. One VPS; Postgres and Redis available.

## Decision
Write a `notification_outbox` row in the same transaction as the order.
A worker process polls pending rows with `FOR UPDATE SKIP LOCKED`, sends,
and marks them sent; retries with exponential backoff up to 6 attempts,
then marks `failed` for staff follow-up. The order id is the idempotency key.

## Options considered
A sync + retry (rejected: latency and failures remain coupled to checkout);
C Redis/BullMQ (rejected: commit-then-enqueue can lose messages on crash);
D managed queue (rejected: new service and credentials for 0.7 msg/s).

## Consequences
+ Checkout latency independent of WA; no lost notifications.
+ Failed messages visible in SQL / admin page.
− One more process to run and monitor.
− Up to a few seconds' delay before the message is sent.

## Revisit when
Sustained > 20 msg/s, or a second consumer of order events appears.
```

Schema and worker loop the ADR implies (for the implementer, via
`data-layer-patterns-edho-ferdian` and `backend-engineering-edho-ferdian`):

```sql
CREATE TABLE notification_outbox (
  id           bigserial PRIMARY KEY,
  order_id     bigint NOT NULL UNIQUE,            -- idempotency
  payload      jsonb  NOT NULL,
  status       text   NOT NULL DEFAULT 'pending', -- pending | sent | failed
  attempts     int    NOT NULL DEFAULT 0,
  next_try_at  timestamptz NOT NULL DEFAULT now(),
  last_error   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON notification_outbox (status, next_try_at);
```

```sql
-- worker: claim a batch without blocking other workers
UPDATE notification_outbox SET attempts = attempts + 1
WHERE id IN (
  SELECT id FROM notification_outbox
  WHERE status = 'pending' AND next_try_at <= now()
  ORDER BY id LIMIT 20
  FOR UPDATE SKIP LOCKED
)
RETURNING id, order_id, payload, attempts;
```

## Step 6 — reflection gate (answers)

- Current-state claims sourced? Yes, file:line for each.
- Did the rejected options get a fair, specific reason? Yes.
- Is "revisit when" measurable? Yes (msg/s, second consumer).
- What would make this wrong? WA provider batching or webhooks changing
  delivery semantics — noted as a risk.

## Change-impact snippet (when the question is "what breaks if…")

```text
Change: move WA sending out of POST /checkout
Direct callers of sendWhatsApp: checkout.ts:88, admin/resend.ts:31
Tests touching it: tests/checkout.test.ts (mocks wa.send) → must assert an outbox row instead
Behaviour change visible to users: confirmation arrives ~1–5 s later
Rollback: feature flag `notify_via_outbox`; old path kept for one release
```
