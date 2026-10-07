import json
from datetime import datetime, timezone

from .bus import publish


def publish_order_paid(order) -> None:
    """Announce a paid order to every subscribed service."""
    event = {
        "type": "order.paid",
        "order_id": order.id,
        "amount": order.total_cents,
        "currency": order.currency,
        "paid_at": datetime.now(timezone.utc).isoformat(),
    }
    publish("orders", json.dumps(event))
