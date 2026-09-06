# Background jobs and queues

A generic reference for running work outside the request/response cycle:
choosing a queue backend, sizing workers, retrying safely, and knowing when a
queue has gone quietly wrong. For the specific collect/enrich/store job
shape (scrapers, feed pollers), see `references/scheduled-collection.md` —
that file covers idempotency and dead-letter handling for that one job
shape; this file covers the general queue-backend and worker-pool concerns
underneath any background job.

## Why a queue instead of "just do it in the request"

Move work off the request path when it is slow (email, PDF generation,
report building), unreliable (a third-party API call that might time out),
or needs to survive the process restarting (a multi-step workflow). Keep it
in the request path only when the caller genuinely cannot proceed without
the result.

## Choosing a queue backend

| Backend | Fits | Cost | Watch out for |
|---|---|---|---|
| Redis-backed (BullMQ / BullMQ Pro, Node) | Most Node apps; need delayed jobs, rate limiting, priorities, flows | Low — reuses existing Redis | Redis is memory-resident; a queue backlog that grows unbounded is an OOM risk, not just a slow-drain risk |
| SQS (AWS) | Already on AWS; need durability across infrastructure loss; multi-consumer fan-out via SNS | Pay-per-message, no server to run | At-least-once delivery is the *default* contract, not an edge case — every consumer must be idempotent; visibility timeout tuning is easy to get wrong (see below) |
| Postgres-based (pg-boss, graphile-worker) | Already on Postgres; want jobs in the same transaction as the business write; want to avoid running a second stateful service | No new infrastructure | Throughput ceiling is real — Postgres is not a purpose-built queue; `SKIP LOCKED` polling adds load under high job volume |
| Cloud task queues (Cloud Tasks, Azure Queue Storage) | Already on that cloud, want managed retry/backoff without running workers 24/7 | Pay-per-invocation, integrates with serverless | Cold-start latency on the handler; harder to reason about ordering |

**The decision that matters most is not the product name — it is whether a
job needing the same transactional guarantee as its triggering database
write can get it.** A Postgres-based queue can enqueue a job in the same
transaction as the row it's about to act on ("insert order, enqueue
'send-confirmation' job" either both commit or neither does). A Redis or SQS
queue cannot — the enqueue is a separate network call that can succeed while
the DB transaction rolls back, or vice versa, producing an orphaned job or a
missing one. If that failure mode is unacceptable for a given job (billing,
order fulfillment), either use a transactional outbox pattern (write an
`outbox` row in the same transaction, a separate poller publishes it to
Redis/SQS) or use a Postgres-based queue directly.

## Worker-pool sizing and concurrency control

- **Concurrency is per-queue, not global.** A worker process handling both
  "send-email" (cheap, high volume) and "generate-report" (CPU-heavy, slow)
  needs separate concurrency limits per queue — one slow report job should
  not starve the email queue's throughput.
- **Size concurrency to the bottleneck resource, not to CPU count.** An
  I/O-bound job (calling a third-party API) can run far more concurrent
  instances than CPU cores; a CPU-bound job (image processing, PDF render)
  should not exceed core count by much.
- **Cap concurrency against downstream capacity**, not just your own. A
  worker pool that fans out to 200 concurrent calls against a payment
  provider's API will get rate-limited or banned — the queue's job is to
  smooth load, not to remove the limit.
- **Separate queues by SLA, not just by job type.** A "send password-reset
  email" job and a "generate monthly report" job may both be "email/report"
  jobs conceptually, but one needs sub-minute latency and the other doesn't
  — put them on different queues with different worker allocations so a
  report backlog never delays a password reset.

```typescript
// BullMQ — per-queue concurrency, not one shared pool
new Worker('emails', processEmailJob, { concurrency: 20 });   // I/O bound, cheap
new Worker('reports', processReportJob, { concurrency: 2 });  // CPU bound, heavy
```

## Retry and backoff strategy

Same principles as any fallible network call
(`references/error-and-resilience.md`), applied to a job runner:

- **Classify the failure before retrying.** A validation error in the job
  payload will fail identically on every retry — send it straight to the
  dead-letter queue, don't burn attempts. A timeout calling a downstream
  service is transient — retry it.
- **Exponential backoff with jitter**, same as any retry loop. A job queue
  processing thousands of jobs that all fail at once (a downstream outage)
  and all retry on a fixed schedule recreates the exact thundering-herd
  problem the queue was supposed to smooth out.
- **Cap attempts, and make the cap visible.** Three to five attempts is a
  reasonable default; more than that usually means the job should have
  failed fast and gone to the dead-letter queue sooner.
- **The retry must be idempotent** (see below) — a queue's automatic retry
  is the single most common source of "why did the customer get charged
  twice" bugs, because the *queue itself* re-delivers, independent of any
  retry logic the job author wrote.

```typescript
// BullMQ job options — explicit attempts, explicit backoff shape
await queue.add('charge-customer', payload, {
  attempts: 4,
  backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s, 16s
  removeOnComplete: true,
  removeOnFail: false, // keep failed jobs for DLQ inspection
});
```

## Dead-letter queues, generically

A dead-letter queue (DLQ) is where a job goes after it has exhausted its
retries or been classified as non-retryable. It exists to answer one
question later: **what work did we fail to do, and can we redo it safely?**

- **Every DLQ entry needs enough context to replay it**: the original
  payload, the failure reason, the timestamp, and the number of attempts
  made. A DLQ that stores only "job failed" with no payload is unreplayable
  — it's a log entry pretending to be a queue.
- **A DLQ needs an owner and a review cadence**, not just a place to dump
  failures. An unreviewed DLQ that only grows is equivalent to silently
  dropping the work — nobody is any better off than if the job had thrown
  the error into `/dev/null`.
- **Provide a replay path**: a script or admin action that re-enqueues a DLQ
  entry (or a filtered batch of them) onto the original queue after the root
  cause is fixed. Without a replay path, "we fixed the bug" still leaves
  every failed job stuck.
- **Alert on DLQ depth crossing zero**, not just on it growing large. A
  DLQ that has *any* entries after a quiet period is itself the signal —
  don't wait for a threshold that implies some DLQ traffic is normal.

```typescript
// BullMQ — a job's final failure handler moves it to an explicit DLQ
worker.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts!) {
    await deadLetterQueue.add('dead-charge-customer', {
      originalPayload: job.data,
      failureReason: err.message,
      failedAt: new Date().toISOString(),
      attemptsMade: job.attemptsMade,
    });
  }
});
```

## Job idempotency keys

Every job that has an external side effect (charge a card, send an email,
create an order) needs a stable idempotency key so a redelivery — whether
from a retry, a queue's at-least-once guarantee, or a manual DLQ replay —
does not repeat the effect.

- **Derive the key from the business operation, not from the job's queue
  metadata.** `order-{orderId}-charge` survives being re-enqueued with a new
  job ID; a queue-generated job ID does not, because a replay creates a
  fresh one.
- **Enforce the key at the effect, not just in the job runner.** A unique
  constraint on `(order_id, operation)` in the database, or an idempotency-
  key header the payment provider itself deduplicates on, is the actual
  guarantee. A job runner that merely "tries not to re-run" is not a
  guarantee — a concurrent worker or a crash-and-resume can still race past
  it.
- **Store the outcome, not just the intent.** After a charge succeeds,
  record it keyed by the idempotency key before acknowledging the job. On
  redelivery, check for that record first and short-circuit rather than
  re-calling the payment provider.

```typescript
async function chargeCustomerJob(job: Job<{ orderId: string; amount: number }>) {
  const idempotencyKey = `order-${job.data.orderId}-charge`;
  const existing = await charges.findByIdempotencyKey(idempotencyKey);
  if (existing) return existing; // already done, redelivery is a no-op

  const result = await paymentGateway.charge({
    amount: job.data.amount,
    idempotencyKey, // pass it to the provider too — belt and suspenders
  });
  await charges.record(idempotencyKey, result);
  return result;
}
```

## Observability for queues

A queue that silently stops draining looks, from the outside, exactly like
a queue that has nothing to do. Both are "queue is empty" from a naive
metric. Instrument for the difference:

- **Queue depth over time**, alerted on sustained growth, not a static
  threshold — a queue that normally sits at 500 and spikes to 2,000 during
  a traffic burst is fine; a queue that used to drain to 0 nightly and now
  sits at 500 permanently is not.
- **Stuck-job detection**: a job that has been in the "active/processing"
  state longer than its expected max runtime is stuck, not slow. Most queue
  libraries expose a "stalled" or "lock expired" event for exactly this —
  wire it to an alert, don't let it silently retry forever.
- **Age of oldest pending job**, not just count. A queue with 10 jobs where
  the oldest has waited 6 hours is a worse signal than a queue with 10,000
  jobs all under a minute old.
- **Per-queue success/failure rate**, not just an aggregate across every
  queue in the system — a 100% failure rate on one queue drowns in a
  healthy aggregate across ten others.
- **DLQ depth**, as its own alert (see above) — this is the single highest-
  signal queue metric because a healthy system's DLQ should sit at or near
  zero.

Severity classification for these alerts follows
`deployment-ops-edho-ferdian/references/observability.md` — this file names
what to measure; that file names how loud to be about it.

## SQS-specific note: visibility timeout

Because it comes up constantly and is a frequent source of duplicate
processing: SQS's visibility timeout must exceed the job's maximum expected
processing time, including retries within the handler itself. If the
handler takes longer than the visibility timeout, SQS makes the message
visible to another consumer *while the first one is still working on it* —
producing two consumers processing the same message concurrently. Set the
timeout with headroom, and extend it programmatically for jobs whose runtime
is genuinely variable rather than guessing high and eating the latency cost
on every message.

## Anti-patterns

| Anti-pattern | Why it hurts | Instead |
|---|---|---|
| One global concurrency setting across all job types | A slow job type starves a fast, latency-sensitive one | Per-queue concurrency, sized to each job's bottleneck |
| Retrying a validation/programmer error | Burns every attempt on a failure that can never succeed | Classify failure type before retrying; non-retryable → DLQ immediately |
| DLQ with no payload, only an error string | Unreplayable — can't redo the work even after the fix ships | Store the full original payload plus failure context |
| No DLQ owner or replay path | Equivalent to silently dropping the work | Named owner, review cadence, a replay action |
| Idempotency key derived from the queue's job ID | A retry or replay gets a new ID, defeating the key | Derive from the business operation identity |
| SQS visibility timeout shorter than worst-case processing time | Two consumers process the same message concurrently | Set timeout with headroom; extend programmatically for long jobs |
| Alerting only on "queue count > N" | Misses a slow-drain queue that never crosses the static threshold | Alert on growth trend and on oldest-pending-job age |

## Provenance

Adapted from general industry practice around message-queue architecture
(BullMQ/BullMQ Pro, AWS SQS, pg-boss/graphile-worker documentation and
common operational patterns) — see
`skills/backend-engineering-edho-ferdian/SKILL.md` provenance note for
comparison of house style. No single ECC agent covers generic queue
architecture; `references/scheduled-collection.md` in this same skill
covers the adjacent scraper-specific job shape and should be read alongside
this file rather than duplicated from it.
