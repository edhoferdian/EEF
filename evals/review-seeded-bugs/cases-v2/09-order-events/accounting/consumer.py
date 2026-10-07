import json

from .ledger import book_revenue


def handle(message: str) -> None:
    """Book revenue for every paid order published on the orders topic."""
    event = json.loads(message)
    if event["type"] != "order.paid":
        return
    book_revenue(
        order_id=event["order_id"],
        amount_cents=event["amount_cents"],
        currency=event["currency"],
    )
