from datetime import date
from decimal import Decimal

from app.services.invoices import build_invoice


def test_tax_is_computed_on_the_subtotal_not_per_line():
    # Per line: 0.11 * 0.05 rounds to 0.01 three times = 0.03.
    # On the subtotal: 0.11 * 0.15 = 0.0165 -> 0.02. The subtotal rule wins.
    lines = [("a", Decimal("0.05")), ("b", Decimal("0.05")), ("c", Decimal("0.05"))]
    invoice = build_invoice(1, 1, lines, date(2026, 1, 1))
    assert invoice.tax == Decimal("0.02")
    assert invoice.total == Decimal("0.17")
