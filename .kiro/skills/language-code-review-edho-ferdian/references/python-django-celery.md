# Language Lens — Python / Django / Celery

**Requires: `python.md` + `python-django.md` (load first).** This file is an
add-on conditional lens layered on top of the Django lens — it assumes
general Python idiom checks and Django ORM/migration/DRF checks already ran.
It adds only **Celery-specific async-task-correctness criteria** on top.

**Detect.** `celery` present in `requirements*.txt` / `pyproject.toml`
dependencies, **or** a `celery.py` app-entrypoint file, **or** a `tasks.py`
file defining `@shared_task`/`@app.task`-decorated functions, anywhere in the
review scope. Celery is an **add-on to the Django/Python detection** — it
loads alongside `python.md` + `python-django.md` when detected, never alone
(a Django project using Celery gets all three; a non-Django Python project
using Celery gets `python.md` + this file, skipping `python-django.md`).

**Boundary — read before flagging anything.** Generic Python idiom (mutable
defaults, bare except, type hints) stays owned by `python.md`. Generic
Django ORM/migration/DRF concerns stay owned by `python-django.md`. This
lens adds only what's specific to **background-task correctness**: a task
runs on a different process, at a different time, possibly more than once,
and possibly after the code that queued it has already moved on — the
review questions here are about that gap, not about the business logic
inside the task itself.

**Code placement.** Findings land as **CQ-10 (Celery-specific
anti-patterns)** in the general report; a task-queue-induced request-latency
finding (e.g. calling a task synchronously in a request path) lands as
**PERF-08**. This lens has no dedicated SEC-08 security items of its own
beyond what's already covered by the general and Django lenses (a task
handling secrets/PII is still bound by the general skill's secret-handling
and Django's own security criteria) — don't invent a parallel Celery
security section.

---

## Ground-truth commands

```bash
celery -A <app> inspect active                 # tasks currently running per worker
celery -A <app> inspect reserved                # tasks claimed but not yet started
celery -A <app> inspect stats                   # worker concurrency/prefetch config, ground-truth for retry/backoff review
grep -rn "CELERY_TASK_ALWAYS_EAGER" .           # confirm test settings run tasks synchronously, not just assumed
grep -rn "@shared_task\|@app.task" --include=*.py .   # enumerate task definitions in scope
pytest -k celery                                 # or the project's actual task test selector
```

Do not assert a retry/backoff or idempotency finding as [High confidence]
purely from reading the task body — confirm the task's actual decorator
arguments (`max_retries`, `retry_backoff`, `acks_late`) and, where the
question is "does this actually run twice under retry," trace a concrete
retry path (a caught exception that calls `self.retry(...)`, or
`autoretry_for` firing) rather than assuming from the task's shape alone.

---

## Lens criteria

### HIGH

- **Task not idempotent, with no guard against duplicate execution** — a
  task can run more than once in the normal operation of any task queue
  (worker crash after execution but before ack, a retry that fires after
  the first attempt actually succeeded but timed out reporting back,
  `acks_late=True` re-delivering after a crash). A task that charges a
  card, sends a one-time email, or increments a counter with no guard
  (a status check before acting, a `select_for_update` + status-transition
  pattern, an idempotency key) will double-charge, double-send, or
  double-count on re-delivery. Flag any task with an observable side effect
  and no visible guard against running twice with the same arguments.
  **CQ-10.**
  ```python
  # Bad — double-charges on redelivery
  @shared_task
  def charge_and_fulfill(order_id):
      order = Order.objects.get(pk=order_id)
      order.charge()
      order.fulfill()

  # Good — guarded by status transition
  @shared_task
  def charge_and_fulfill(order_id):
      order = Order.objects.select_for_update().get(pk=order_id)
      if order.status != Order.Status.PENDING:
          return  # already processed
      order.charge()
      order.fulfill()
  ```
- **Non-serializable object passed as a task argument** — `.delay(user)` or
  `.apply_async(args=[queryset])` passing a Django model instance, a
  queryset, or any other live ORM/session-bound object instead of its
  primary key. Two separate problems, not one: (1) the default JSON
  serializer either fails outright or silently falls back to `pickle`
  (a security and portability problem of its own), and (2) even if
  serialization "worked," the object is a **snapshot from enqueue time** —
  by the time the task actually executes, the row may have changed or been
  deleted, and the task is working with stale data without knowing it. Fix:
  pass the ID, refetch inside the task. **CQ-10.**
- **`.delay()`/`.apply_async()` called inside a still-open DB transaction**
  — queuing a task from inside a `transaction.atomic()` block (or any code
  path where the surrounding view/service hasn't committed yet) risks the
  task firing and running **before the transaction commits**, so the task
  reads a database state that doesn't yet include the very row it was
  queued to act on (or, if the transaction later rolls back, acts on a row
  that never actually existed). Fix: `transaction.on_commit(lambda:
  my_task.delay(obj.pk))`, which defers the enqueue until the transaction
  actually commits, or a demonstrably-guaranteed-committed call site.
  **CQ-10.**
  ```python
  # Bad — task may run before this commits, or after a rollback
  with transaction.atomic():
      order = Order.objects.create(...)
      process_order.delay(order.pk)

  # Good
  with transaction.atomic():
      order = Order.objects.create(...)
      transaction.on_commit(lambda: process_order.delay(order.pk))
  ```
- **Missing or absent retry/backoff configuration on a task that calls an
  external, fallible dependency** (HTTP API, another service, a flaky
  queue) — no `max_retries`, no `autoretry_for`, or a retry with no backoff
  (`retry_backoff` unset, so every retry fires immediately and can hammer
  an already-struggling upstream, or contribute to a thundering herd across
  many queued instances of the same task). Recommend `autoretry_for=(...)`
  with `retry_backoff=True` (and `retry_jitter=True` under real concurrent
  load) over a bare `try/except: self.retry()` with no delay strategy.
  **CQ-10.**
- **No task timeout configured for a task that can hang** — a task calling
  a network dependency, waiting on a lock, or doing unbounded work with
  neither a `soft_time_limit` (to allow cleanup) nor a `time_limit` (hard
  kill) set at the task or worker-config level. An unbounded task can hold
  a worker slot indefinitely, and combined with
  `CELERY_WORKER_PREFETCH_MULTIPLIER` defaults, can starve other queued
  work behind it. **CQ-10 / PERF-08.**

### MEDIUM

- **Task result backend correctness not verified for a task whose result is
  actually consumed** — a caller does `result = my_task.apply_async(...)`
  and later reads `.get()`/`.result`, but the project either has no result
  backend configured (`CELERY_RESULT_BACKEND` unset/`ignore_result=True` on
  a task whose result the caller then tries to read), or a result-backend
  choice that doesn't match the deployment's failure-mode expectations
  (e.g. an in-memory backend that loses results on worker restart, when the
  caller expects results to survive it). If a task sets
  `ignore_result=True` while a call site elsewhere reads its result, that
  combination is a concrete bug, not a style note — flag at HIGH instead
  when you can point to the specific mismatched call site.
- **Synchronous task call in a request-response path** — `result =
  my_task.apply(...)` (or `.get()` immediately after `.delay()`) inside a
  view/handler, defeating the entire purpose of offloading to a task queue
  by blocking the request thread for the task's full duration anyway.
  **PERF-08.**
- **`CELERY_TASK_ALWAYS_EAGER` relied upon in production-path code, not just
  tests** — code that behaves differently (or is only ever exercised)
  because tasks run synchronously in the current environment; verify this
  setting is confined to test configuration and not accidentally left on in
  a deployed settings file.
- **Beat schedule with no single-node guarantee** — a `CELERY_BEAT_SCHEDULE`
  or `django-celery-beat` periodic task with more than one Beat process
  capable of running it concurrently (no leader-election/lock, no
  documented single-instance deployment constraint) — produces duplicate
  scheduled executions. Ask how the deployment ensures only one Beat
  scheduler runs, don't assume it does.

---

## False-positive traps

- A task with **no observable side effect** (a pure computation task whose
  result the caller reads and the task itself mutates nothing) does not
  need an idempotency guard — the idempotency finding is about side
  effects, not about "does this task have `max_retries`."
- Passing a small, genuinely immutable, JSON-serializable value object
  (a plain `dict`/`dataclass` snapshot deliberately captured at enqueue
  time, documented as intentionally not re-fetched) is not the same finding
  as passing a live ORM instance — the concern is staleness and
  serializability of *live* objects, not all non-primitive arguments.
  Verify the argument is actually ORM-bound before flagging.
- `.delay()` called outside any transaction context (a plain function, a
  signal handler already firing post-commit, a management command) has no
  `transaction.on_commit()` finding to make — that pattern only applies
  inside an open `atomic()` block.
- A task queued from inside `transaction.atomic()` that is immediately
  followed by an explicit `transaction.commit()` in the same block (rare,
  manual transaction management) may already be safe — verify the actual
  commit ordering before flagging, rather than pattern-matching on
  "`.delay()` appears somewhere inside `atomic()`."
- Missing retry/backoff on a task that only ever calls **idempotent,
  already-retried-at-a-lower-layer** operations (e.g. the HTTP client
  itself already retries with backoff) is lower-priority than flagged
  above — note the existing lower-layer retry rather than treating the
  task as unprotected.

## Escalate to general domain when…

- The finding is about the **business logic inside the task** with no
  task-queue-specific mechanism behind it (e.g. an N+1 query inside a task
  body) — that's `python-django.md`'s PERF-08 criteria, not this file.
- The finding is about **general Python exception handling** unrelated to
  Celery's retry mechanism (a bare `except: pass` with no `self.retry`
  involved) — that's `python.md`, not this file.
- A performance claim about task-queue throughput/latency needs actual
  queue-depth or worker-utilization monitoring evidence (Flower, `celery
  inspect stats` over time) to size real impact — escalate to
  `performance-audit-edho-ferdian` per the general skill's PERF escalation
  rule; this lens only establishes that the pattern exists.
