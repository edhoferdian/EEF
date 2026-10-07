# PayProvider API notes

## POST /v1/charges

Creates and captures a charge in one call.

- Not idempotent by default. Send an `Idempotency-Key` header (any unique
  string per logical charge) to make retries safe: a repeated key returns
  the original charge instead of creating a new one.
- A request that times out on the client may still have succeeded on the
  server.
