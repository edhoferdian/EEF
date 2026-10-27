from dataclasses import dataclass

from shop.services import record_audit


@dataclass(frozen=True)
class Order:
    id: int
    total_cents: int


def place_order(order_id: int, total_cents: int) -> Order:
    order = Order(order_id, total_cents)
    record_audit(order)
    return order
