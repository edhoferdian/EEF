# Error taxonomy and resilience

## Principles

1. **Fail loudly at the boundary, gracefully at the edge.** Internal code
   throws typed errors; exactly one layer converts them into a user-facing
   shape.
2. **An error type is part of your API.** If a caller must branch on it, it
   needs a stable discriminant — not a string message they will regex.
3. **Never catch to silence.** An empty catch, a `return null` fallback that
   hides the cause, or a log-and-continue that loses the failure are all the
   same bug. → `code-review-edho-ferdian/references/silent-failure-lens.md`
   (CQ-05a..e) is the enforcement side of this rule.

## Shape by language

- **TypeScript** — a base `AppError` with `code`, `statusCode`, and
  `isOperational`; subclasses per category. One centralised handler maps
  operational errors to responses and lets programmer errors crash loudly.
  Consider a Result type for expected failures (validation, not-found) and
  keep throwing for the unexpected.
- **Python** — a custom exception hierarchy rooted in one project base; a
  framework-level global handler (e.g. FastAPI exception handler) is the only
  place that formats a response.
- **Go** — sentinel errors plus `%w` wrapping; callers use `errors.Is` /
  `errors.As`, never string comparison.

## Retry, backoff, and the circuit breaker

- **Retry only transient failures**: network errors, rate limits, 5xx.
  **Never** retry authentication or validation errors — that burns budget on a
  permanent failure and can lock an account.
- Exponential backoff **with jitter**. Without jitter, every client retries in
  the same instant and you have built a self-inflicted thundering herd.
- Cap total attempts *and* total elapsed time; a retry loop with only an
  attempt cap can hold a request open for minutes.
- **Retries require idempotency.** A retried non-idempotent write is a
  duplicate charge, a duplicate order, a duplicate email. Idempotency keys
  belong in the design, not in the retry wrapper.
- Add a circuit breaker when a dependency's failure would otherwise saturate
  your own thread/connection pool — the breaker protects *you*, not the
  dependency.

## Third-party email/webhook delivery

Treat every send to a third-party email or webhook provider as a fallible
network call, not a fire-and-forget side effect:

- **Wrap it like any other fallible network call** — it gets the same
  retry/backoff and circuit-breaker treatment as above, not a bare call with
  no error path.
- **Check the response status.** A 200 from the provider's API is not proof
  of delivery; a queued/accepted status is not a delivered status. Branch on
  what the provider actually returned.
- **Log enough context to debug without re-sending**: recipient (or
  destination URL for a webhook), template/event name, timestamp, and the
  provider's response code. That is the minimum needed to answer "did this
  go out and what happened" without guessing.
- **Never point a non-production environment at the production sending
  endpoint or credentials.** Dev and staging must route to the provider's
  sandbox/capture endpoint so test sends are caught there — a test email that
  lands in a real customer's inbox cannot be unsent.

## User-facing messages

Say what happened, whether it is retryable, and what the user can do. Never
leak stack traces, SQL, internal hostnames, or provider error strings. Attach
a correlation id the user can quote and you can grep.
