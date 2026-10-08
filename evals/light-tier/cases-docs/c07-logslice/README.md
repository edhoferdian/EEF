# logslice

Print the lines of a log file that fall inside a time window.

## Usage

    logslice <file> --since 2026-10-01T08:00 [--until 2026-10-01T09:00] [-n 100] [-v]

| Option | Description |
|---|---|
| `--since <time>` | Start of the window (ISO 8601), required |
| `--until <time>` | End of the window; defaults to now |
| `-n, --limit <n>` | Stop after this many lines |
| `-v, --verbose` | Also print how many lines were skipped |

Timestamps are parsed by `logslice/parse.py`; lines without a leading
timestamp are attached to the previous line.

## Library use

```python
from logslice import slice_lines

with open("app.log", encoding="utf-8") as fh:
    for line in slice_lines(fh, since="2026-10-01T08:00", until="2026-10-01T09:00"):
        print(line, end="")
```
