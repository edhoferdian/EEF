from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Account, LedgerEntry


class InsufficientFunds(Exception):
    pass


def withdraw(session: Session, account_id: int, amount: Decimal) -> Decimal:
    """Withdraw amount from the account and return the new balance.

    Called concurrently from several API workers.
    """
    if amount <= 0:
        raise ValueError("amount must be positive")
    account = session.execute(
        select(Account).where(Account.id == account_id)
    ).scalar_one()
    if account.balance < amount:
        raise InsufficientFunds(account_id)
    account.balance = account.balance - amount
    session.add(LedgerEntry(account_id=account_id, delta=-amount))
    session.commit()
    return account.balance
