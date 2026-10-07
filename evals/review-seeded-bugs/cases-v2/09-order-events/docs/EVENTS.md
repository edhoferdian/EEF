# Events on the `orders` topic

## order.paid (v1)

| Field | Type | Notes |
|---|---|---|
| type | string | always `order.paid` |
| order_id | int | |
| amount_cents | int | order total in minor units |
| currency | string | ISO 4217 |
| paid_at | string | ISO 8601, UTC |

Consumers: accounting (books revenue), analytics.
