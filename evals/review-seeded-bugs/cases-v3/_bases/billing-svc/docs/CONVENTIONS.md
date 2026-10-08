# billing-svc conventions

## Tenancy
Every customer, invoice and line belongs to one account (`account_id`).
Every query on those tables filters by the caller's account from
`current_account()`. Never take an account id from the request.

## Money and tax
Amounts are `Decimal`, never `float`. Tax is computed **once, on the
invoice subtotal**, by `services.tax.tax_for()` (ROUND_HALF_UP to the
cent) — never per line, which drifts by a cent on multi-line invoices
(see tests/test_tax.py).

## Logging
Never log personal data: no email, name, phone or address. Log ids
(`customer_id`, `invoice_id`) only.
