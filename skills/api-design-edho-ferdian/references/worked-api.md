# Worked API — an orders API from resources to OpenAPI

One API designed with `rest-conventions.md` and evolved with
`contract-evolution.md`: resources, status codes, pagination, errors,
idempotency, and a breaking change done without breaking clients.

## 1. Resources and operations

| Operation | Request | Success | Notes |
|---|---|---|---|
| List orders | `GET /v1/orders?status=paid&limit=20&cursor=…` | 200 | cursor pagination |
| Get one | `GET /v1/orders/{id}` | 200 / 404 | |
| Create | `POST /v1/orders` + `Idempotency-Key` | 201 + `Location` | retries safe |
| Partial update | `PATCH /v1/orders/{id}` | 200 | only listed fields |
| Cancel | `POST /v1/orders/{id}/cancel` | 200 / 409 | state transition as an action |
| Order items | `GET /v1/orders/{id}/items` | 200 | sub-resource |

Nouns for resources, actions only for state transitions that aren't a
field update (`cancel`, `refund`). Plural collection names. IDs opaque
(UUIDs), never sequential if they leak business volume.

## 2. Payload conventions

```json
{
  "id": "ord_01JD8Y3W6Q",
  "status": "paid",
  "currency": "IDR",
  "total_amount": 90000,
  "items": [{ "product_id": "prd_7A2", "quantity": 2, "unit_amount": 45000 }],
  "customer": { "name": "Sari", "phone": "6281234567890" },
  "created_at": "2026-11-19T03:12:44Z"
}
```

- Money as integers in the smallest unit plus an explicit currency.
- Timestamps in UTC ISO 8601; the client localises.
- One naming style everywhere (here snake_case).
- Enums as lowercase strings; document every value.

## 3. Errors — one shape (RFC 9457 problem details)

```http
HTTP/1.1 422 Unprocessable Content
Content-Type: application/problem+json

{
  "type": "https://api.example.com/problems/validation",
  "title": "Validation failed",
  "status": 422,
  "detail": "2 fields are invalid",
  "errors": [
    { "field": "items[0].quantity", "code": "min", "message": "must be at least 1" },
    { "field": "customer.phone", "code": "format", "message": "must be an Indonesian mobile number" }
  ],
  "trace_id": "4bf92f3577b34da6"
}
```

| Situation | Status |
|---|---|
| Malformed JSON | 400 |
| Not authenticated / not allowed | 401 / 403 |
| Not found (or not yours) | 404 |
| Wrong state for the action (cancel a shipped order) | 409 |
| Valid JSON, invalid values | 422 |
| Rate limited | 429 + `Retry-After` |

## 4. Cursor pagination

```http
GET /v1/orders?limit=20&cursor=eyJjIjoiMjAyNi0xMS0xOVQwMzoxMjo0NFoiLCJpIjoib3JkXzAxIn0
```

```json
{ "data": [ … ], "next_cursor": "eyJjIjoi…", "has_more": true }
```

The cursor encodes the last row's sort keys (`created_at`, `id`) so
inserts don't shift pages; the server query is
`WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT $3`.
Offset pagination only for small, admin-only lists.

## 5. Idempotent create

```http
POST /v1/orders
Idempotency-Key: 6c4f1d0e-8b1a-4b5e-9e21-4d7c1f0a9b3e
```

Server: store `(key, request hash) → response` for 24 h. Same key + same
body → return the stored response; same key + different body → 422. This
makes client retries after a timeout safe.

## 6. The OpenAPI contract (single source of truth)

```yaml
openapi: 3.1.0
info: { title: Orders API, version: 1.3.0 }
paths:
  /v1/orders:
    post:
      operationId: createOrder
      parameters:
        - { name: Idempotency-Key, in: header, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/CreateOrder" }
      responses:
        "201":
          description: Created
          headers: { Location: { schema: { type: string } } }
          content: { application/json: { schema: { $ref: "#/components/schemas/Order" } } }
        "422": { $ref: "#/components/responses/Problem" }
components:
  schemas:
    CreateOrder:
      type: object
      required: [items, customer]
      additionalProperties: false
      properties:
        items:
          type: array
          minItems: 1
          items:
            type: object
            required: [product_id, quantity]
            properties:
              product_id: { type: string }
              quantity: { type: integer, minimum: 1, maximum: 99 }
        customer: { $ref: "#/components/schemas/Customer" }
```

Generate the server validators and the client types from this file, and
fail CI when they drift:

```bash
npx --yes openapi-typescript openapi.yaml -o src/api/schema.d.ts
npx --yes @redocly/cli lint openapi.yaml
git diff --exit-code src/api/schema.d.ts      # generated file must be committed and current
```

## 7. Evolving it — a breaking change without breaking clients

Need: `customer.name` becomes `customer.first_name` + `last_name`.

1. **Add, don't change** (v1.4.0): return both shapes; accept both on input.
2. **Deprecate**: mark `name` `deprecated: true` in OpenAPI; send
   `Deprecation` and `Sunset: Sat, 31 Jan 2027 00:00:00 GMT` headers when a
   request uses it; log which clients still send it.
3. **Remove** only after the sunset date and when logs show no use — or
   in `/v2` if some clients can't move.

Changes that are always breaking: removing/renaming a field, making an
optional field required, changing a type or enum meaning, changing status
codes clients rely on. Adding optional fields and new endpoints isn't —
as long as clients ignore unknown fields (say so in the docs).

## 8. Contract test

```ts
import { readFileSync } from "node:fs";
import OpenAPIResponseValidator from "openapi-response-validator";   // or an equivalent validator

it("POST /v1/orders matches the contract", async () => {
  const res = await request(app).post("/v1/orders").set("Idempotency-Key", crypto.randomUUID()).send(validBody);
  expect(res.status).toBe(201);
  expect(validate201(res.body)).toBeUndefined();         // validator built from openapi.yaml
});
```
