# Worked Tests — designing the cases, then writing them

How to go from a function or component to a small set of tests that
actually catch bugs. Stack references (`react.md`, `python-pytest.md`,
`go.md`, `vue.md`) cover tooling; this file covers choosing cases.

## 1. Pick cases from the behaviour, not the code

Function under test:

```ts
/** Shipping cost in rupiah. Free above Rp500.000, flat by region otherwise; pickup is free. */
export function shippingCost(order: { total: number; region: "jabodetabek" | "jawa" | "luar-jawa"; pickup: boolean }): number
```

Case list (equivalence classes + boundaries + each rule once):

| Case | Input | Expected | Why |
|---|---|---|---|
| Pickup | pickup, total 10k | 0 | rule: pickup is free |
| Just below free threshold | 499,999 jabodetabek | 15,000 | boundary −1 |
| At threshold | 500,000 | 0 | boundary (≥ or >? decided: ≥) |
| Each region | 100k × 3 regions | 15k / 25k / 45k | one per class |
| Zero total | 0 | region fee | edge |
| Negative total | −1 | throws | invalid input |

## 2. Table-driven (TypeScript / Vitest)

```ts
import { describe, it, expect } from "vitest";
import { shippingCost } from "./shipping";

describe("shippingCost", () => {
  it.each([
    { name: "pickup is free", order: { total: 10_000, region: "jawa", pickup: true }, want: 0 },
    { name: "just below threshold", order: { total: 499_999, region: "jabodetabek", pickup: false }, want: 15_000 },
    { name: "at threshold is free", order: { total: 500_000, region: "luar-jawa", pickup: false }, want: 0 },
    { name: "jawa flat fee", order: { total: 100_000, region: "jawa", pickup: false }, want: 25_000 },
    { name: "luar jawa flat fee", order: { total: 100_000, region: "luar-jawa", pickup: false }, want: 45_000 },
  ] as const)("$name", ({ order, want }) => {
    expect(shippingCost(order)).toBe(want);
  });

  it("rejects a negative total", () => {
    expect(() => shippingCost({ total: -1, region: "jawa", pickup: false })).toThrow(/total/);
  });
});
```

## 3. The same in pytest

```python
import pytest
from shop.shipping import shipping_cost

@pytest.mark.parametrize(
    "total, region, pickup, want",
    [
        (10_000, "jawa", True, 0),
        (499_999, "jabodetabek", False, 15_000),
        (500_000, "luar-jawa", False, 0),
        (100_000, "jawa", False, 25_000),
    ],
    ids=["pickup", "below-threshold", "at-threshold", "jawa"],
)
def test_shipping_cost(total, region, pickup, want):
    assert shipping_cost(total=total, region=region, pickup=pickup) == want

def test_negative_total_rejected():
    with pytest.raises(ValueError, match="total"):
        shipping_cost(total=-1, region="jawa", pickup=False)
```

## 4. Time, randomness and the network — control them

```ts
// time
vi.useFakeTimers();
vi.setSystemTime(new Date("2026-11-19T23:59:00+07:00"));
expect(isStoreOpen()).toBe(false);
vi.useRealTimers();

// network at the boundary with MSW (the component's real fetch code runs)
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
const server = setupServer(http.get("/api/orders", () => HttpResponse.json([{ id: "1", total: 45000 }])));
beforeAll(() => server.listen()); afterEach(() => server.resetHandlers()); afterAll(() => server.close());

it("shows an error when the API fails", async () => {
  server.use(http.get("/api/orders", () => new HttpResponse(null, { status: 500 })));
  render(<Orders />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/gagal/i);
});
```

```python
# pytest: freeze time and stub HTTP
from freezegun import freeze_time
import respx, httpx

@freeze_time("2026-11-19 23:59:00+07:00")
def test_store_closed_at_midnight():
    assert not is_store_open()

@respx.mock
def test_rate_lookup_failure_falls_back():
    respx.get("https://api.example.com/rates").mock(return_value=httpx.Response(503))
    assert get_rate("USD") == DEFAULT_RATE
```

Mock what you don't own (network, clock, randomness); don't mock the code
under test or its simple collaborators.

## 5. A React hook

```ts
import { renderHook, act } from "@testing-library/react";
import { useCart } from "./useCart";

it("adds, increments and totals items", () => {
  const { result } = renderHook(() => useCart());
  act(() => result.current.add({ id: "k1", price: 18_000 }));
  act(() => result.current.add({ id: "k1", price: 18_000 }));
  expect(result.current.items).toEqual([{ id: "k1", price: 18_000, qty: 2 }]);
  expect(result.current.total).toBe(36_000);
});
```

## 6. Go: table tests with subtests

```go
func TestShippingCost(t *testing.T) {
	tests := []struct {
		name  string
		order Order
		want  int
	}{
		{"pickup free", Order{Total: 10_000, Region: Jawa, Pickup: true}, 0},
		{"at threshold", Order{Total: 500_000, Region: LuarJawa}, 0},
		{"jawa fee", Order{Total: 100_000, Region: Jawa}, 25_000},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := ShippingCost(tt.order); got != tt.want {
				t.Errorf("ShippingCost() = %d, want %d", got, tt.want)
			}
		})
	}
}
```

## 7. Property-based tests for invariants

When a rule must hold for every input, let the tool search for a
counterexample:

```ts
import fc from "fast-check";
it("total never goes below zero after any discount", () => {
  fc.assert(fc.property(fc.nat(10_000_000), fc.nat(100), (subtotal, pct) => {
    expect(applyDiscount(subtotal, pct)).toBeGreaterThanOrEqual(0);
  }));
});
```

```python
from hypothesis import given, strategies as st
@given(st.integers(min_value=0, max_value=10_000_000), st.integers(min_value=0, max_value=100))
def test_discount_never_negative(subtotal, pct):
    assert apply_discount(subtotal, pct) >= 0
```

## 8. A regression test for a reported bug

1. Reproduce with the smallest input → write the test → watch it fail.
2. Fix → watch it pass.
3. Name it after the behaviour, link the issue:

```ts
it("keeps the coupon discount when quantity changes (issue #212)", () => { … });
```

## Quality check before committing tests

- [ ] Each test fails if the behaviour it names breaks (try it: break the code once).
- [ ] Names describe behaviour, not implementation (`"rejects expired coupon"`, not `"calls validate()"`).
- [ ] No sleeps; no order dependence; no shared mutable state between tests.
- [ ] Assertions on outcomes users see (text, status, returned values), not internals.
