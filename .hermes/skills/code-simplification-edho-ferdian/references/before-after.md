# Before / After — each simplification pattern in code

Companion to SKILL.md Phase 2. Every example is behaviour-preserving: the
same inputs give the same outputs and side effects. Apply one, run the
tests, then the next.

## Guard clauses instead of nesting (TypeScript)

```ts
// Before — 4 levels deep
function shippingCost(order: Order): number {
  if (order) {
    if (order.items.length > 0) {
      if (!order.pickup) {
        if (order.total >= 500_000) {
          return 0;
        } else {
          return order.region === "jabodetabek" ? 15_000 : 30_000;
        }
      } else {
        return 0;
      }
    } else {
      throw new Error("empty order");
    }
  }
  throw new Error("no order");
}

// After — same results, one level
function shippingCost(order: Order): number {
  if (!order) throw new Error("no order");
  if (order.items.length === 0) throw new Error("empty order");
  if (order.pickup) return 0;
  if (order.total >= 500_000) return 0;
  return order.region === "jabodetabek" ? 15_000 : 30_000;
}
```

## Extract function (Python)

```python
# Before — one function doing parsing, validation and saving
def import_users(path):
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            email = row["email"].strip().lower()
            if "@" not in email:
                continue
            rows.append({"email": email, "name": row["name"].strip()})
    for r in rows:
        if not User.objects.filter(email=r["email"]).exists():
            User.objects.create(**r)
    return len(rows)

# After — each step named; behaviour identical
def import_users(path):
    rows = list(_valid_rows(_read_csv(path)))
    _create_missing(rows)
    return len(rows)

def _read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        yield from csv.DictReader(f)

def _valid_rows(raw_rows):
    for row in raw_rows:
        email = row["email"].strip().lower()
        if "@" in email:
            yield {"email": email, "name": row["name"].strip()}

def _create_missing(rows):
    for r in rows:
        if not User.objects.filter(email=r["email"]).exists():
            User.objects.create(**r)
```

Note what did **not** change: the N+1 query in `_create_missing`. Fixing
it (bulk insert) changes behaviour under concurrency — that is a separate,
announced change, not part of a simplification pass.

## Consolidate duplicate branches

```ts
// Before
switch (event.type) {
  case "created":
    log.info("order event", { id: event.id, type: "created" });
    await notify(event.userId, `Order ${event.id} created`);
    break;
  case "paid":
    log.info("order event", { id: event.id, type: "paid" });
    await notify(event.userId, `Order ${event.id} paid`);
    break;
  case "shipped":
    log.info("order event", { id: event.id, type: "shipped" });
    await notify(event.userId, `Order ${event.id} shipped`);
    break;
}

// After
const NOTIFY_TYPES = new Set(["created", "paid", "shipped"]);
if (NOTIFY_TYPES.has(event.type)) {
  log.info("order event", { id: event.id, type: event.type });
  await notify(event.userId, `Order ${event.id} ${event.type}`);
}
```

Check first: are the strings user-facing and translated? If the copy
differs per type in the future, a lookup table is better than string
interpolation.

## Loop → idiomatic higher-order call

```ts
// Before
const result: string[] = [];
for (let i = 0; i < users.length; i++) {
  if (users[i].active) {
    result.push(users[i].email.toLowerCase());
  }
}

// After
const result = users.filter((u) => u.active).map((u) => u.email.toLowerCase());
```

Keep the loop when it has early exits with side effects, or when the
chained version would allocate large intermediate arrays in a hot path.

## Collapse unnecessary indirection (over-factored)

```ts
// Before — interface, factory and class for one implementation used in one place
interface IDateFormatter { format(d: Date): string }
class IdDateFormatter implements IDateFormatter {
  format(d: Date) { return d.toLocaleDateString("id-ID"); }
}
class DateFormatterFactory { static create(): IDateFormatter { return new IdDateFormatter(); } }
const label = DateFormatterFactory.create().format(order.createdAt);

// After
const formatDate = (d: Date) => d.toLocaleDateString("id-ID");
const label = formatDate(order.createdAt);
```

Only when there is truly one implementation and no test seam depends on
the interface — search for every reference first.

## Replace conditional with a table (data, not polymorphism)

```python
# Before
def tax_rate(category):
    if category == "food":
        return 0.0
    elif category == "books":
        return 0.0
    elif category == "electronics":
        return 0.11
    elif category == "luxury":
        return 0.11
    else:
        return 0.11

# After
TAX_RATES = {"food": 0.0, "books": 0.0}
DEFAULT_TAX = 0.11

def tax_rate(category):
    return TAX_RATES.get(category, DEFAULT_TAX)
```

Polymorphism/strategy only when each branch carries **behaviour**, three
or more branches exist, and new branches are expected.

## Flatten async pyramids

```ts
// Before
function load(id: string) {
  return fetchUser(id).then((user) => {
    return fetchOrders(user.id).then((orders) => {
      return fetchInvoices(orders.map((o) => o.id)).then((invoices) => {
        return { user, orders, invoices };
      });
    });
  });
}

// After
async function load(id: string) {
  const user = await fetchUser(id);
  const orders = await fetchOrders(user.id);
  const invoices = await fetchInvoices(orders.map((o) => o.id));
  return { user, orders, invoices };
}
```

Same order of calls, same error propagation. Making `fetchOrders` and
another call parallel would change timing — not a simplification.

## Name magic values

```go
// Before
if time.Since(lastSeen) > 900*time.Second && retries < 3 { ... }

// After
const (
	sessionIdleTimeout = 15 * time.Minute
	maxRetries         = 3
)
if time.Since(lastSeen) > sessionIdleTimeout && retries < maxRetries { ... }
```

## Simplify boolean logic

```ts
// Before
if (isAdmin === true) { return true; } else { return false; }
const canEdit = !(!user.isOwner && !user.isAdmin);

// After
return isAdmin;
const canEdit = user.isOwner || user.isAdmin;
```

## Report row (Phase 3)

```markdown
| # | File | Pattern | Before → After | Tests |
|---|---|---|---|---|
| 1 | src/shipping.ts:12 | Guard clauses | nesting 4 → 1, 22 → 9 lines | `npm test shipping` 14/14 ✔ |
| 2 | src/events.ts:40 | Consolidate branches | 3 duplicated arms → 1 | 9/9 ✔ |
Not changed (behaviour risk): N+1 query in users/import.py:31 — proposed separately.
```
