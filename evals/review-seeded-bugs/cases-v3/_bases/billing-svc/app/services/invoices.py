from datetime import date, timedelta
from decimal import Decimal

from ..config import DUE_DAYS
from ..models import Invoice, InvoiceLine
from .tax import tax_for


def build_invoice(account_id: int, customer_id: int, lines: list[tuple[str, Decimal]], today: date) -> Invoice:
    subtotal = sum((amount for _, amount in lines), Decimal("0"))
    tax = tax_for(subtotal)
    invoice = Invoice(
        account_id=account_id,
        customer_id=customer_id,
        subtotal=subtotal,
        tax=tax,
        total=subtotal + tax,
        due_on=today + timedelta(days=DUE_DAYS),
    )
    invoice.lines = [InvoiceLine(description=d, amount=a) for d, a in lines]
    return invoice
