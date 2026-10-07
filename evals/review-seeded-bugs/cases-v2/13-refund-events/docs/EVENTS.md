# Events on the `orders` topic

## order.refunded (v1)

| Field | Type | Notes |
|---|---|---|
| type | string | always `order.refunded` |
| order_id | int | |
| amount_cents | int | refunded amount in minor units |
| currency | string | ISO 4217 |
| refunded_at | string | ISO 8601, UTC |

Consumers: accounting (reverses revenue), analytics. Adding an optional
field is a compatible change; renaming or removing one is not.
