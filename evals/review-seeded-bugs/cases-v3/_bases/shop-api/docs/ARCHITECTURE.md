# shop-api architecture

## Money
Every amount is an integer number of **cents** (`Cents` in src/money.ts).
Never use floats or dollar amounts in code; convert only at the edge with
`formatCents` for display.

## Placing an order
`POST /orders` runs these steps, in this order:
1. `inventory.reserve(items)` - holds stock; throws `OutOfStock`.
2. `payments.charge(customer, total)` - charges the card.
3. If the charge fails, `inventory.release(reservation)` and return 402.
4. `orders.create(...)`, then `email.orderConfirmation(...)`.

Charging before reserving is forbidden: a paid order with no stock costs a
refund and a support ticket.

## Roles
A user's `role` (`customer` | `staff` | `admin`) changes only through
`PATCH /admin/users/:id/role`. User-facing routes must never write `role`.
