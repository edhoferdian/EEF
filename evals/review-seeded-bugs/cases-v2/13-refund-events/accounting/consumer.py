import json

from .ledger import reverse_revenue


def handle(message: str) -> None:
    """Reverse booked revenue for every refunded order on the orders topic."""
    event = json.loads(message)
    if event["type"] != "order.refunded":
        return
    reverse_revenue(
        order_id=event["order_id"],
        amount_cents=event["amount_cents"],
        currency=event["currency"],
    )
