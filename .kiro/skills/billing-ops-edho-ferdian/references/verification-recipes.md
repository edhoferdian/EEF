# Verification Recipes — read-only checks for billing incidents

Commands and queries for Step 1 (classify) and Step 2 (verify against the
code). Everything here **reads**. Refunds, credits, cancellations and
subscription edits stay behind Step 3's explicit go-ahead and happen in
the provider's own dashboard or the team's approved tooling.

Use test mode / a read-only restricted key where possible. Never paste a
live secret key into chat or commit it; read it from the environment.

## Stripe

### Customer snapshot

```bash
# All subscriptions for one customer, any status (Stripe CLI, read-only)
stripe subscriptions list --customer cus_123 --status all --limit 20

# Active only — two or more is the duplicate-subscription signal
stripe subscriptions list --customer cus_123 --status active

# Recent invoices and whether they were paid
stripe invoices list --customer cus_123 --limit 10

# Payment attempts, including failures and their decline codes
stripe payment_intents list --customer cus_123 --limit 10

# Checkout sessions — "complete" with no subscription = broken fulfilment
stripe checkout sessions list --customer cus_123 --limit 10
```

Same customer by email when the ID is unknown:

```bash
stripe customers search --query "email:'pelanggan@example.com'"
```

Several customer objects for one email is a common root cause of
"subscribed twice": each checkout created a new customer.

### Duplicate vs. multi-seat

| Signal | Accidental duplicate | Intended multi-seat |
|---|---|---|
| Created | Minutes apart | Days apart / on request |
| Same price & quantity | Yes | Often different quantity or price |
| Checkout sessions | Two completed sessions, double-click / retry | One session with quantity > 1 |
| Seats in use (app DB) | Only one subscription's seats used | Both used |

### Webhook health

```bash
# Recent events for a subscription or checkout
stripe events list --type checkout.session.completed --limit 20
stripe events retrieve evt_123

# Forward events to a local handler while reproducing in test mode
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

Check in the dashboard (Developers → Webhooks) for failed deliveries and
their response codes — a handler returning 500 means Stripe retried, which
can double-fulfil if the handler isn't idempotent.

## Your own database

```sql
-- Customers with more than one active subscription
SELECT user_id, COUNT(*) AS active_subs, ARRAY_AGG(provider_subscription_id) AS subs
FROM subscriptions
WHERE status IN ('active', 'trialing', 'past_due')
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Paid checkouts with no entitlement granted (fulfilment gap)
SELECT c.id, c.user_id, c.completed_at
FROM checkout_sessions c
LEFT JOIN entitlements e ON e.user_id = c.user_id AND e.granted_at >= c.completed_at
WHERE c.status = 'complete' AND e.id IS NULL
  AND c.completed_at > now() - interval '30 days';

-- Webhook events processed more than once
SELECT provider_event_id, COUNT(*) FROM webhook_events GROUP BY 1 HAVING COUNT(*) > 1;
```

Adjust table names to the project; read the schema first.

## Verify the claim in the code

What the pricing page or the support reply says is a claim. The code is
the truth. Find where each claim is enforced:

```bash
rg -n "seats|maxSeats|plan\.limits|entitlement|hasFeature|isPro|canUse" src/
rg -n "checkout\.session\.completed|customer\.subscription\.(created|updated|deleted)|invoice\.(paid|payment_failed)" src/
rg -n "cancel_at_period_end|proration|trial_end" src/
```

Questions to answer with file:line evidence:

1. Which webhook grants access, and which revokes it?
2. Is access keyed on `customer`, `subscription` or the app user — and can
   one user map to several customers?
3. Does cancel revoke immediately or at period end — and does the UI say
   the same?
4. Is the plan limit enforced server-side, or only hidden in the UI?

## What a correct webhook handler looks like

Use this to judge the project's handler (Node/Express, Stripe SDK):

```ts
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"]!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return res.status(400).send("bad signature");                 // never trust unsigned bodies
  }

  // Idempotency: one row per provider event id, unique constraint in the DB
  const inserted = await db.webhookEvents.insertIfAbsent({ providerEventId: event.id, type: event.type });
  if (!inserted) return res.sendStatus(200);                        // already handled → ack, do nothing

  switch (event.type) {
    case "checkout.session.completed":
      await grantAccess(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.deleted":
      await revokeAccess((event.data.object as Stripe.Subscription).id);
      break;
  }
  res.sendStatus(200);                                              // ack fast; heavy work → queue
});
```

Findings to look for: no signature check, JSON body parser before the raw
body (signature always fails), no idempotency, granting access on
`checkout.session.completed` without checking `payment_status === "paid"`
for async payment methods, slow handlers that time out and get retried.

## Indonesian gateways (Midtrans / Xendit)

- **Midtrans**: verify notifications with the `signature_key`
  (SHA-512 of `order_id + status_code + gross_amount + server_key`) and
  re-fetch status with the Status API before granting access; treat
  `settlement`/`capture` (with `fraud_status: accept`) as paid, `pending`
  as not yet.
- **Xendit**: verify the `x-callback-token` header against the dashboard
  token; use the invoice/payment request status from the API, not only the
  callback body.
- Both: idempotency on the provider's transaction ID, exactly like the
  Stripe example.

Check the provider's current docs (Context7 or the official site) before
quoting a field name to the user — gateways rename fields between API
versions.

## Handoff block (Step 4)

```markdown
## Billing incident — <customer ref, no PII in tickets>

Class: duplicate subscription (accidental)
Evidence:
- sub_A created 2026-11-03 10:02, sub_B 10:03 — same price, quantity 1
- two completed checkout sessions 41 s apart (double submit)
- only sub_A's seat in use (app DB)

Customer remediation (needs approval): cancel sub_B immediately, refund its first invoice (in_…)
Product fix: disable the checkout button after first submit; create the
Stripe customer once per user (lookup before create); add idempotency key on session creation.
Verified in code: src/billing/checkout.ts:44 creates a new customer every time.
Owner: <name>   Status: awaiting approval
```
