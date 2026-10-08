from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")


def apply_percent_discount(amount: Decimal, percent: Decimal) -> Decimal:
    """Amount after a percentage discount, rounded half-up to the cent."""
    if not Decimal("0") <= percent <= Decimal("100"):
        raise ValueError("percent must be between 0 and 100")
    return (amount * (Decimal("100") - percent) / Decimal("100")).quantize(CENT, rounding=ROUND_HALF_UP)
