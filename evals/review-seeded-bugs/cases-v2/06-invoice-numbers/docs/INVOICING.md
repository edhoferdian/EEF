# Invoicing

Invoice numbers run sequentially per calendar year: `2026-000001`,
`2026-000002`, ... Tax rules require every number to be unique.

Invoices are created by the order workers when an order is paid. The
workers run as 8 processes in parallel.
