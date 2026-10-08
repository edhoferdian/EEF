from datetime import date

from app.services.reminders import reminder_date


def test_reminder_goes_out_three_days_before_due():
    assert reminder_date(date(2026, 3, 10)) == date(2026, 3, 7)
