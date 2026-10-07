from datetime import datetime, time

from sqlalchemy import func, select

from orders.models import Order


def todays_revenue(session) -> int:
    """Total revenue in cents for today's orders, for the store dashboard."""
    start = datetime.combine(datetime.now().date(), time.min)
    return session.execute(
        select(func.coalesce(func.sum(Order.total_cents), 0)).where(Order.created_at >= start)
    ).scalar_one()
