"""tally — plain-text ledger reader."""
from .ledger import Entry, Ledger, load_ledger

__all__ = ["Entry", "Ledger", "load_ledger"]
