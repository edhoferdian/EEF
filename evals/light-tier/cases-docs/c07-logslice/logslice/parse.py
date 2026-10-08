import re
from datetime import datetime

_TS = re.compile(r"^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?)")


def leading_timestamp(line: str) -> datetime | None:
    m = _TS.match(line)
    return datetime.fromisoformat(m.group(1).replace(" ", "T")) if m else None
