from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path


@dataclass(frozen=True)
class Entry:
    date: date
    memo: str
    postings: tuple[tuple[str, Decimal], ...]


@dataclass
class Ledger:
    entries: list[Entry] = field(default_factory=list)

    def balance(self, account: str) -> Decimal:
        return sum(
            (amount for e in self.entries for name, amount in e.postings if name.startswith(account)),
            Decimal(0),
        )

    def entries_between(self, start: str, end: str) -> list[Entry]:
        lo, hi = date.fromisoformat(start), date.fromisoformat(end)
        return [e for e in self.entries if lo <= e.date <= hi]


def load_ledger(path: str | Path) -> Ledger:
    """Read a ledger file. Renamed from parse_ledger in 2.0."""
    blocks = Path(path).read_text(encoding="utf-8").strip().split("\n\n")
    entries = []
    for block in blocks:
        head, *lines = block.splitlines()
        day, memo = head.split(" ", 1)
        postings = tuple((name, Decimal(amount)) for name, amount in (l.split() for l in lines))
        entries.append(Entry(date.fromisoformat(day), memo, postings))
    return Ledger(entries)
