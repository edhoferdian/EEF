# tally

A small reader for plain-text double-entry ledgers.

## Install

    pip install tally-ledger

## Usage

```python
from tally import parse_ledger

ledger = parse_ledger("books.ledger")
print(ledger.balance("assets:bank"))
for entry in ledger.entries_between("2026-01-01", "2026-03-31"):
    print(entry.date, entry.memo)
```

## Ledger format

One transaction per block; the first line is `YYYY-MM-DD memo`, followed by
indented `account  amount` postings that sum to zero.
