# Worked Mining — one capability, from code to anchored spec

The protocol from `mining-protocol.md` applied to one capability
("discount codes") in an undocumented Express app, producing entries in
the `spec-format.md` shape. Every requirement points at the code that
enforces it; anything the code doesn't settle becomes an uncertainty.

## 1. Find the capability's code

```bash
rg -n -i "coupon|discount|promo" src --type ts -l
rg -n "router\.(get|post|put|patch|delete)\(.*(coupon|discount)" src
salak query importers src/services/coupon.ts      # who depends on it (if the graph exists)
```

Files: `src/routes/checkout.ts`, `src/services/coupon.ts`,
`src/models/Coupon.ts`, `src/jobs/expireCoupons.ts`, one test file with 3
tests.

## 2. Read and extract behaviour

```ts
// src/services/coupon.ts (excerpt)
export async function applyCoupon(code: string, cart: Cart, user: User) {
  const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });          // L12
  if (!coupon || coupon.expiresAt < new Date()) throw new CouponError("INVALID");    // L13
  if (coupon.usedCount >= coupon.maxUses) throw new CouponError("EXHAUSTED");         // L14
  if (cart.subtotal < coupon.minSubtotal) throw new CouponError("MIN_SUBTOTAL");      // L15
  if (coupon.firstOrderOnly && (await Order.count({ userId: user.id })) > 0)          // L16
    throw new CouponError("FIRST_ORDER_ONLY");
  const discount = coupon.type === "percent"
    ? Math.min(Math.floor(cart.subtotal * coupon.value / 100), coupon.maxDiscount ?? Infinity)  // L19
    : coupon.value;                                                                   // L20
  return { discount: Math.min(discount, cart.subtotal), coupon };                     // L21
}
```

## 3. Emit the spec

```markdown
# Capability: Discount codes

## Requirements

### REQ-DC-01 Code matching is case- and whitespace-insensitive
WHEN a customer enters " hemat10 "
THEN it matches coupon HEMAT10
Anchor: src/services/coupon.ts:12 (trim + toUpperCase)
Test: none — add one.

### REQ-DC-02 Expired or unknown codes are rejected
WHEN the code doesn't exist OR now > expiresAt
THEN the error INVALID is returned (no distinction between the two)
Anchor: coupon.ts:13
Test: tests/coupon.test.ts "rejects expired"

### REQ-DC-03 Usage limit
WHEN usedCount >= maxUses
THEN EXHAUSTED
Anchor: coupon.ts:14

### REQ-DC-04 Minimum subtotal
WHEN cart.subtotal < minSubtotal
THEN MIN_SUBTOTAL
Anchor: coupon.ts:15

### REQ-DC-05 First-order-only codes
WHEN firstOrderOnly AND the user has any previous order (any status)
THEN FIRST_ORDER_ONLY
Anchor: coupon.ts:16

### REQ-DC-06 Percent discount, capped
WHEN type = percent
THEN discount = floor(subtotal × value / 100), capped by maxDiscount if set
Anchor: coupon.ts:19

### REQ-DC-07 Discount never exceeds the subtotal
THEN discount = min(computed, subtotal)
Anchor: coupon.ts:21

## Invariants
- INV-DC-1 total after discount ≥ 0 (REQ-DC-07).
- INV-DC-2 usedCount increments once per paid order (anchor: src/routes/checkout.ts:88, after payment success).

## Uncertainties
- UNC-DC-1 Expiry compares against server time (`new Date()`), timezone of
  `expiresAt` unknown — is a coupon "valid until 31 Dec" valid on 31 Dec WIB?
- UNC-DC-2 REQ-DC-05 counts cancelled/failed orders as "previous orders".
  Intended?
- UNC-DC-3 Race: two checkouts can both pass REQ-DC-03 before usedCount
  increments (check and increment aren't atomic). Behaviour today: limit
  can be exceeded under concurrency.
- UNC-DC-4 `jobs/expireCoupons.ts` sets `active=false`, but applyCoupon
  never reads `active`. Dead flag or missing check?
```

## 4. Confidence and what to do next

```markdown
Coverage: 7 requirements, 2 invariants, 4 uncertainties.
Tested: 2 of 7 requirements have tests (REQ-DC-02, REQ-DC-06).
Hand-off:
- dev-kickoff: use this as BEHAVIOR_SPEC for the "coupon v2" work.
- test-authoring: characterisation tests for REQ-DC-01, 03, 04, 05, 07 before any change.
- Uncertainties UNC-DC-1..4 go to the owner as questions, not fixes.
```

## Characterisation test (pins today's behaviour, including the odd parts)

```ts
it("REQ-DC-05: a cancelled previous order still blocks first-order coupons (current behaviour, see UNC-DC-2)", async () => {
  await Order.create({ userId: user.id, status: "cancelled" });
  await expect(applyCoupon("WELCOME", cart, user)).rejects.toMatchObject({ code: "FIRST_ORDER_ONLY" });
});
```

Characterisation tests describe what the code does now; if the owner
decides the behaviour is wrong, the test changes with the fix — on
purpose, in the same PR.
