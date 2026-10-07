import json
from datetime import datetime, timezone

from .bus import publish


def publish_order_refunded(order, refund) -> None:
    """Announce a refunded order to every subscribed service."""
    event = {
        "type": "order.refunded",
        "order_id": order.id,
        "amount_cents": refund.amount_cents,
        "currency": order.currency,
        "refunded_at": datetime.now(timezone.utc).isoformat(),
        # New, optional field: consumers that don't know it ignore it.
        "reason": refund.reason,
    }
    publish("orders", json.dumps(event))
