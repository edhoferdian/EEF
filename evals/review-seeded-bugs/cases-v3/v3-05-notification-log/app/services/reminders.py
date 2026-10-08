from datetime import date, timedelta

from ..config import REMINDER_DAYS_BEFORE_DUE


def reminder_date(due_on: date) -> date:
    """The day a payment reminder goes out for an invoice due on due_on."""
    return due_on - timedelta(days=REMINDER_DAYS_BEFORE_DUE)
