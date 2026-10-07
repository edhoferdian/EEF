from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Invoice


def next_invoice_number(session: Session, today: date) -> str:
    """Return the next invoice number for today's year, e.g. '2026-000042'."""
    prefix = f"{today.year}-"
    last = session.execute(
        select(func.max(Invoice.number)).where(Invoice.number.like(prefix + "%"))
    ).scalar()
    seq = int(last.split("-")[1]) + 1 if last else 1
    return f"{prefix}{seq:06d}"
