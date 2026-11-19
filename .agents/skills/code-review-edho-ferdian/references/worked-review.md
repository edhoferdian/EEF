# Worked Review — one diff through all five phases

A realistic small PR, reviewed end to end, so the phases in SKILL.md have
a concrete shape: what evidence looks like, how the Critic removes a false
positive, and what the saved report contains.

## The diff under review

```ts
// src/routes/orders.ts  (new endpoint)
router.post("/orders/:id/refund", async (req, res) => {
  const order = await db.order.findUnique({ where: { id: req.params.id } });
  if (order.status === "refunded") return res.status(400).send("already refunded");
  const amount = req.body.amount ?? order.total;
  await stripe.refunds.create({ payment_intent: order.paymentIntentId, amount });
  await db.order.update({ where: { id: order.id }, data: { status: "refunded" } });
  res.json({ ok: true });
});
```

```tsx
// src/components/RefundButton.tsx
export function RefundButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  async function onClick() {
    setLoading(true);
    await fetch(`/api/orders/${orderId}/refund`, { method: "POST" });
    setLoading(false);
  }
  return <button onClick={onClick}>{loading ? "Processing…" : "Refund"}</button>;
}
```

## Phase 0 — scope and context

```bash
git diff --stat origin/main...HEAD
rg -n "router.use\(|requireAuth|requireRole" src/routes src/middleware   # how are routes protected?
rg -n "refund" src tests                                                 # existing refund logic/tests?
```

Findings that change the review: routes under `/admin` use
`requireRole("admin")` (`src/routes/index.ts:22`), but this router is
mounted at `/api` with only `requireAuth`. No test file touches refunds.
Stack: Express + Prisma + Stripe, React. Load
`language-code-review-edho-ferdian` lenses for Express/Prisma/React; the
change touches money → add `security-review-edho-ferdian` depth.

## Phase 1 — five domains (draft findings)

**Security**
- S1 Any logged-in user can refund any order: no ownership/role check
  (`orders.ts:2`). Evidence: mounted at `/api` with `requireAuth` only
  (`index.ts:31`); `/admin` routes use `requireRole("admin")`.
- S2 Client-controlled `amount` (`orders.ts:5`) — no bounds; a negative or
  larger-than-paid amount goes to Stripe.

**Correctness**
- C1 `order` may be `null` → `TypeError` → 500 (`orders.ts:3`).
- C2 Refund then DB update are not atomic: if the update fails after
  Stripe succeeds, the order stays "paid" and can be refunded again.
- C3 Double click sends two refunds: no idempotency key, button not
  disabled while loading (`RefundButton.tsx:5`).

**Performance** — nothing material.

**Spec consistency** — Ticket says "staff can issue partial refunds up to
the paid amount": partial refunds are allowed (matches), cap is missing
(S2).

**Tests** — no tests for the endpoint or the button (T1).

**Silent failure lens** — the button ignores a non-2xx response; the user
sees "Refund" again with no error (F1).

## Phase 2 — ground-truth verification

Each finding gets checked against the real code, not the diff alone:

```bash
rg -n "app.use\(\"/api\"" src        # confirms S1's mount point
rg -n "findUnique" src | head          # how do other routes handle null? → they use findUniqueOrThrow + error middleware
node -e "console.log(require('stripe/package.json').version)"   # idempotencyKey supported in this SDK version
```

## Phase 3 — reflection

Is any finding a style preference dressed as a defect? Is severity tied to
user impact? C2 and C3 both lead to double refunds — one root cause
(no idempotency) seen from two sides; merge them.

## Phase 4 — Critic pass

The Critic gets the code and the draft, nothing else, and attacks:

- **S1** — "Maybe ownership is checked in middleware." → Rechecked:
  `requireAuth` only sets `req.user`. **Stands.**
- **C1** — "Prisma error middleware returns 404 for missing records." →
  Only for `findUniqueOrThrow` (`P2025`); `findUnique` returns `null`.
  **Stands**, downgraded to MEDIUM (500 instead of 404, no data harm).
- **F1** — "Toast library shows errors globally." → `rg "fetch\(" src/lib`
  shows no global fetch wrapper; this uses raw `fetch`. **Stands.**
- **Perf note "N+1 in orders list"** (from an earlier draft) — not in this
  diff. **Dropped** (out of scope; logged as a follow-up, not a finding).

## Phase 5 — the report

```markdown
# Review — PR #142 "Refund button for orders"

Verdict: REQUEST CHANGES (1 critical, 2 high)

## CRITICAL
**S1 — Any authenticated user can refund any order**  `src/routes/orders.ts:2`
Mounted under `/api` with `requireAuth` only (`src/routes/index.ts:31`). A customer
can POST /api/orders/<any id>/refund.
Fix: mount under the admin router or add `requireRole("admin")`; also check
the order belongs to the staff member's store if stores are scoped.

## HIGH
**C2/C3 — Double refunds possible**  `orders.ts:6-7`, `RefundButton.tsx:5`
Stripe call and DB update aren't atomic, there's no idempotency key, and the
button can be clicked twice.
Fix:
```ts
const refund = await stripe.refunds.create(
  { payment_intent: order.paymentIntentId, amount },
  { idempotencyKey: `refund:${order.id}:${amount}` },
);
await db.order.update({ where: { id: order.id, status: "paid" }, data: { status: "refunded", refundId: refund.id } });
```
and `disabled={loading}` on the button.

**S2 — Refund amount not bounded**  `orders.ts:5`
Validate `0 < amount <= order.total - order.refundedTotal` (zod schema) and
return 422 otherwise.

## MEDIUM
**C1 — Missing order returns 500**  `orders.ts:3` — use `findUniqueOrThrow`
like the other routes, so the error middleware returns 404.
**F1 — Failure is silent in the UI**  `RefundButton.tsx:6` — check
`res.ok`, show an error toast, keep the button enabled for retry.

## Tests (T1)
Add: endpoint denies non-admin (403); refund twice → one Stripe call
(mock asserts idempotency key); amount > total → 422; button disabled while
pending and shows the error on 500.

## Checked and fine
Partial refunds match the ticket. Prisma usage otherwise follows the repo's
patterns.

Evidence commands: listed in the saved report's appendix.
```

## PR comment form (when posting to GitHub)

Inline comments only for CRITICAL/HIGH, each with the fix; one summary
comment with the verdict and the MEDIUM list. Never approve with an open
CRITICAL.
