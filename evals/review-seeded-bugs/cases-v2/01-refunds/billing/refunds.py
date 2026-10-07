from datetime import datetime, timedelta, timezone
from decimal import Decimal

from .gateway import issue_refund
from .models import Charge

REFUND_WINDOW = timedelta(days=180)


class RefundRejected(Exception):
    pass


def refund(charge: Charge, amount: Decimal) -> None:
    """Refund part or all of a captured charge."""
    if amount <= 0:
        raise RefundRejected("refund amount must be positive")
    if datetime.now(timezone.utc) - charge.captured_at > REFUND_WINDOW:
        raise RefundRejected("refund window has closed")
    if amount > charge.amount:
        raise RefundRejected("refund exceeds the captured amount")
    issue_refund(charge.id, amount)
    charge.refunded_total += amount
