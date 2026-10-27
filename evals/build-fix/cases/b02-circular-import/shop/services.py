from shop.models import Order

AUDIT_LOG: list[str] = []


def record_audit(order: Order) -> None:
    AUDIT_LOG.append(f"order {order.id}: {order.total_cents}")
