# Codemap — Billing

Last Updated: 2026-05-02

## src/billing/subscription.ts

Starts, renews and cancels customer subscriptions.

Exports:
- `startSubscription(customerId, planId)` — creates a subscription
- `cancelSubscription(id)` — cancels at period end

## src/billing/invoice.ts

Builds invoices from orders and tracks their payment state. Invoice numbers
are allocated per store.

Exports:
- `createInvoice(order)` — creates a draft invoice
- `voidInvoice(id)` — voids an unpaid invoice
- `markPaid(id, paidAt)` — records payment

- `exportCsv(range)` — CSV export of invoices for a date range
