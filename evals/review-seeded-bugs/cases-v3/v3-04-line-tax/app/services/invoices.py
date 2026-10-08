from datetime import date, timedelta
from decimal import Decimal

from ..config import DUE_DAYS
from ..models import Invoice, InvoiceLine
from .tax import tax_for


def build_invoice(account_id: int, customer_id: int, lines: list[tuple[str, Decimal]], today: date) -> Invoice:
    # Tax each line so the line breakdown on the PDF adds up exactly.
    line_items = [InvoiceLine(description=d, amount=a) for d, a in lines]
    subtotal = sum((line.amount for line in line_items), Decimal("0"))
    tax = sum((tax_for(line.amount) for line in line_items), Decimal("0"))
    invoice = Invoice(
        account_id=account_id,
        customer_id=customer_id,
        subtotal=subtotal,
        tax=tax,
        total=subtotal + tax,
        due_on=today + timedelta(days=DUE_DAYS),
    )
    invoice.lines = line_items
    return invoice
