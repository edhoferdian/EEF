from decimal import ROUND_HALF_UP, Decimal

from ..config import TAX_RATE

CENT = Decimal("0.01")


def tax_for(subtotal: Decimal) -> Decimal:
    """Tax on a subtotal, rounded half-up to the cent."""
    return (subtotal * TAX_RATE).quantize(CENT, rounding=ROUND_HALF_UP)
