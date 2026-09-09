# REST Conventions — Resource Shape, Status Codes, Pagination, Rate Limiting, Versioning

This is the detailed reference for Step 1 (REST shape). Read it when
designing or reviewing a new endpoint or a set of related endpoints.

## 1. Resource naming

```
# Resources are nouns, plural, lowercase, kebab-case
GET    /api/v1/users
GET    /api/v1/users/:id
POST   /api/v1/users
PUT    /api/v1/users/:id
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id

# Sub-resources for relationships
GET    /api/v1/users/:id/orders
POST   /api/v1/users/:id/orders

# Actions that don't map to CRUD (use verbs sparingly, on a sub-path)
POST   /api/v1/orders/:id/cancel
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
```

```
# GOOD
/api/v1/team-members          # kebab-case for multi-word resources
/api/v1/orders?status=active  # query params for filtering
/api/v1/users/123/orders      # nested resources for ownership

# BAD
/api/v1/getUsers              # verb in URL
/api/v1/user                  # singular (use plural)
/api/v1/team_members          # snake_case in URLs
/api/v1/users/123/getOrders   # verb in nested resource
```

## 2. HTTP method semantics

| Method | Idempotent | Safe | Use For |
|--------|-----------|------|---------|
| GET | Yes | Yes | Retrieve resources |
| POST | No | No | Create resources, trigger actions |
| PUT | Yes | No | Full replacement of a resource |
| PATCH | No* | No | Partial update of a resource |
| DELETE | Yes | No | Remove a resource |

*PATCH can be made idempotent with proper implementation.

## 3. Status-code semantics — the correct code for the situation, not just 200/404/500

```
# Success
200 OK                    — GET, PUT, PATCH (with response body)
201 Created               — POST (include Location header)
204 No Content            — DELETE, PUT (no response body)

# Client Errors
400 Bad Request           — Validation failure, malformed JSON
401 Unauthorized          — Missing or invalid authentication
403 Forbidden             — Authenticated but not authorized
404 Not Found             — Resource doesn't exist
409 Conflict              — Duplicate entry, state conflict
422 Unprocessable Entity  — Semantically invalid (valid JSON, bad data)
429 Too Many Requests     — Rate limit exceeded

# Server Errors
500 Internal Server Error — Unexpected failure (never expose details)
502 Bad Gateway           — Upstream service failed
503 Service Unavailable   — Temporary overload, include Retry-After
```

Common mistakes to design away from:

```
# BAD: 200 for everything
{ "status": 200, "success": false, "error": "Not found" }

# GOOD: use HTTP status codes semantically
HTTP/1.1 404 Not Found
{ "error": { "code": "not_found", "message": "User not found" } }

# BAD: 500 for validation errors        → use 400 or 422 with field details
# BAD: 200 for created resources        → use 201 with Location header
```

## 4. Response envelope and error-shape conventions

Pick one envelope and use it for **every** endpoint in the boundary — a
consistent shape is what lets a client write one response parser instead of
one per endpoint.

**Success — single resource:**

```json
{
  "data": {
    "id": "abc-123",
    "email": "alice@example.com",
    "name": "Alice",
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

**Success — collection (with pagination):**

```json
{
  "data": [
    { "id": "abc-123", "name": "Alice" },
    { "id": "def-456", "name": "Bob" }
  ],
  "meta": {
    "total": 142,
    "page": 1,
    "per_page": 20,
    "total_pages": 8
  },
  "links": {
    "self": "/api/v1/users?page=1&per_page=20",
    "next": "/api/v1/users?page=2&per_page=20",
    "last": "/api/v1/users?page=8&per_page=20"
  }
}
```

**Error — always the same shape, regardless of status code:**

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "Must be a valid email address", "code": "invalid_format" },
      { "field": "age", "message": "Must be between 0 and 150", "code": "out_of_range" }
    ]
  }
}
```

Two envelope options exist — choose one and hold the line:

- **Option A — Envelope with `data`/`error` wrapper** (recommended for public
  or multi-consumer APIs — lets the client distinguish payload from metadata
  without inspecting the status code first).
- **Option B — Flat response** (simpler, common for internal single-consumer
  APIs — success returns the resource directly, error returns the error
  object, and the HTTP status code is what distinguishes them).

Whichever is chosen, every endpoint in the boundary must follow it — a mixed
envelope across endpoints is itself a design defect, not a style nit.

## 5. Pagination — offset vs. cursor decision table

**Offset-based:**

```
GET /api/v1/users?page=2&per_page=20

SELECT * FROM users ORDER BY created_at DESC LIMIT 20 OFFSET 20;
```

Pros: easy to implement, supports "jump to page N."
Cons: slow on large offsets (`OFFSET 100000` still scans and discards those
rows), and — the concurrency problem this ecosystem's database lens covers in
more depth (`code-review-edho-ferdian`'s `references/database-lens.md`,
PERF-07 family) — **under concurrent writes, offset pagination can skip or
duplicate rows**: if a row is inserted or deleted between page 1 and page 2
requests, every row after that point shifts by one offset position, so a
row can be shown twice or never shown at all. This is a correctness bug, not
just a performance one, on any list that mutates while being paged through.

**Cursor-based:**

```
GET /api/v1/users?cursor=eyJpZCI6MTIzfQ&limit=20

SELECT * FROM users WHERE id > :cursor_id ORDER BY id ASC LIMIT 21;
-- fetch one extra row to determine has_next
```

```json
{
  "data": [...],
  "meta": { "has_next": true, "next_cursor": "eyJpZCI6MTQzfQ" }
}
```

Pros: stable under concurrent inserts/deletes, consistent performance
regardless of position in the dataset.
Cons: cannot jump to an arbitrary page number, cursor is opaque to the
client, **requires an indexed, sortable, effectively-unique key** to build
the cursor on (commonly `id` or `(created_at, id)`) — cursor pagination on an
unindexed or non-unique sort key degrades to the same scan cost as offset,
without even the jump-to-page benefit.

| Use Case | Pagination Type |
|----------|----------------|
| Admin dashboards, small datasets (<10K) | Offset |
| Infinite scroll, feeds, large or frequently-mutated datasets | Cursor |
| Public APIs | Cursor (default) with offset (optional) |
| Search results | Offset (users expect page numbers) |

## 6. Filtering, sorting, and sparse fieldsets

```
# Simple equality
GET /api/v1/orders?status=active&customer_id=abc-123

# Comparison operators (bracket notation)
GET /api/v1/products?price[gte]=10&price[lte]=100
GET /api/v1/orders?created_at[after]=2025-01-01

# Multiple values (comma-separated)
GET /api/v1/products?category=electronics,clothing

# Nested fields (dot notation)
GET /api/v1/orders?customer.country=US

# Sorting — single field, "-" prefix for descending
GET /api/v1/products?sort=-created_at

# Sorting — multiple fields
GET /api/v1/products?sort=-featured,price,-created_at

# Full-text search
GET /api/v1/products?q=wireless+headphones

# Sparse fieldsets — return only requested fields, reduces payload
GET /api/v1/users?fields=id,name,email
GET /api/v1/orders?fields=id,total,status&include=customer.name
```

## 7. Rate limiting — tiers and client-facing headers

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000

# When exceeded
HTTP/1.1 429 Too Many Requests
Retry-After: 60
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Try again in 60 seconds."
  }
}
```

| Tier | Limit | Window | Use Case |
|------|-------|--------|----------|
| Anonymous | 30/min | Per IP | Public endpoints |
| Authenticated | 100/min | Per user | Standard API access |
| Premium | 1000/min | Per API key | Paid API plans |
| Internal | 10000/min | Per service | Service-to-service |

The headers are the contract with the client as much as the response body
is — a client that never sees `X-RateLimit-Remaining` cannot back off before
hitting 429, and a 429 with no `Retry-After` forces the client to guess a
retry interval.

## 8. Versioning strategy and `Sunset` header policy

**URL path versioning (recommended):**

```
/api/v1/users
/api/v2/users
```

Pros: explicit, easy to route, cacheable. Cons: URL changes between
versions.

**Header versioning (alternative):**

```
GET /api/users
Accept: application/vnd.myapp.v2+json
```

Pros: clean URLs. Cons: harder to test, easy for a client to forget to set.

**Strategy:**

```
1. Start with /api/v1/ — don't version until you need to.
2. Maintain at most 2 active versions (current + previous).
3. Deprecation timeline:
   - Announce deprecation (6 months notice for public APIs).
   - Add Sunset header: Sunset: Sat, 01 Jan 2026 00:00:00 GMT
   - Return 410 Gone after the sunset date.
4. Non-breaking changes don't need a new version:
   - Adding new fields to responses.
   - Adding new optional query parameters.
   - Adding new endpoints.
5. Breaking changes require a new version:
   - Removing or renaming fields.
   - Changing field types.
   - Changing URL structure.
   - Changing authentication method.
```

The `Sunset` header (RFC 8594) is the machine-readable half of the
deprecation announcement — a client or its tooling can alert on it before the
cutoff date arrives, instead of finding out via a 410 in production.

## 9. Pre-ship checklist — cross-referenced against `code-review-edho-ferdian`

Some items below are fully owned by this skill (design-time, no code exists
yet to review). Others are checked again, mechanically, by
`code-review-edho-ferdian` once the endpoint is implemented — those rows name
the exact review code so the two skills don't restate the same rule from
memory and drift apart.

| Pre-ship item | Owned by | Cross-reference |
|---|---|---|
| Resource URL follows naming conventions (plural, kebab-case, no verbs) | This skill (design-time) | — |
| Correct HTTP method used | This skill (design-time) | — |
| Appropriate status codes returned (not 200 for everything) | This skill (design-time) | — |
| Input validated with schema | Both | `code-review-edho-ferdian` → SEC-01 (input sanitization), CQ-11 (edge cases) |
| Error responses follow the standard format, no internal details leaked | Both | `code-review-edho-ferdian` → SEC-06 (sensitive data), SEC-11 (security misconfiguration) |
| Pagination implemented for list endpoints, correct strategy chosen | Both | `code-review-edho-ferdian` → PERF-07 family (`database-lens.md`, OFFSET vs. cursor, missing indexes) |
| Authentication required, or explicitly marked public | Both | `code-review-edho-ferdian` → SEC-03 (auth check) |
| Authorization checked (user can only access their own resources) | Both | `code-review-edho-ferdian` → SEC-05 (IDOR) |
| Rate limiting configured | Both | `code-review-edho-ferdian` → SEC-08 (rate limiting) |
| Response payload does not exceed what the client needs | Both | `code-review-edho-ferdian` → PERF-08 (payload size) |
| No hardcoded secrets/config in handler code | Both | `code-review-edho-ferdian` → SEC-02 (secret exposure), CQ-03 (hardcoded values) |
| Consistent naming with existing endpoints | This skill (design-time) | — |
| Documented — OpenAPI/schema updated | This skill → hands off to `references/contract-evolution.md` | See also `spec-mining-edho-ferdian` intake note in this skill's `SKILL.md` |

Use this table both ways: at design time, walk the "This skill" rows before
writing any code; at review time, `code-review-edho-ferdian` should cite the
listed code rather than re-deriving a fresh justification for why pagination
or auth matters.

## 10. Language implementation sketches

These are illustrative only — pick the pattern matching the actual stack,
and defer to that stack's own review skill (e.g. `fastapi-reviewer`,
`react-reviewer`) for idiom-level correctness.

**TypeScript (Next.js API Route), with schema validation:**

```typescript
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({
      error: {
        code: "validation_error",
        message: "Request validation failed",
        details: parsed.error.issues.map(i => ({
          field: i.path.join("."),
          message: i.message,
          code: i.code,
        })),
      },
    }, { status: 422 });
  }

  const user = await createUser(parsed.data);

  return NextResponse.json(
    { data: user },
    { status: 201, headers: { Location: `/api/v1/users/${user.id}` } },
  );
}
```

**Python (Django REST Framework):**

```python
from rest_framework import serializers, viewsets, status
from rest_framework.response import Response

class CreateUserSerializer(serializers.Serializer):
    email = serializers.EmailField()
    name = serializers.CharField(max_length=100)

class UserViewSet(viewsets.ModelViewSet):
    def create(self, request):
        serializer = CreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = UserService.create(**serializer.validated_data)
        return Response(
            {"data": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
            headers={"Location": f"/api/v1/users/{user.id}"},
        )
```

**Go (net/http):**

```go
func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
    var req CreateUserRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
        return
    }
    if err := req.Validate(); err != nil {
        writeError(w, http.StatusUnprocessableEntity, "validation_error", err.Error())
        return
    }
    user, err := h.service.Create(r.Context(), req)
    if err != nil {
        switch {
        case errors.Is(err, domain.ErrEmailTaken):
            writeError(w, http.StatusConflict, "email_taken", "Email already registered")
        default:
            writeError(w, http.StatusInternalServerError, "internal_error", "Internal error")
        }
        return
    }
    w.Header().Set("Location", fmt.Sprintf("/api/v1/users/%s", user.ID))
    writeJSON(w, http.StatusCreated, map[string]any{"data": user})
}
```
