from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal


@dataclass
class Charge:
    id: str
    amount: Decimal  # amount originally captured
    refunded_total: Decimal  # sum of every refund issued so far
    captured_at: datetime  # timezone-aware, UTC
