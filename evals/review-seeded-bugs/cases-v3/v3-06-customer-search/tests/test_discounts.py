from decimal import Decimal

import pytest

from app.services.discounts import apply_percent_discount


def test_rounds_half_up_to_the_cent():
    assert apply_percent_discount(Decimal("10.05"), Decimal("10")) == Decimal("9.05")


def test_rejects_out_of_range_percent():
    with pytest.raises(ValueError):
        apply_percent_discount(Decimal("10"), Decimal("120"))
