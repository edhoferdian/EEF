from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Account, LedgerEntry


class InsufficientFunds(Exception):
    pass


def transfer(session: Session, from_id: int, to_id: int, amount: Decimal) -> None:
    """Move amount between two accounts atomically.

    Called concurrently from several API workers.
    """
    if amount <= 0:
        raise ValueError("amount must be positive")
    if from_id == to_id:
        raise ValueError("cannot transfer to the same account")
    with session.begin():
        # Lock both rows in id order so concurrent transfers can't deadlock.
        rows = session.execute(
            select(Account)
            .where(Account.id.in_((from_id, to_id)))
            .order_by(Account.id)
            .with_for_update()
        ).scalars()
        locked = {account.id: account for account in rows}
        if len(locked) != 2:
            raise LookupError("account not found")
        source, target = locked[from_id], locked[to_id]
        if source.balance < amount:
            raise InsufficientFunds(from_id)
        source.balance -= amount
        target.balance += amount
        session.add_all([
            LedgerEntry(account_id=from_id, delta=-amount),
            LedgerEntry(account_id=to_id, delta=amount),
        ])
