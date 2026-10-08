from collections.abc import Callable, Iterable, Iterator
from datetime import datetime

from .parse import leading_timestamp


def slice_lines(
    lines: Iterable[str], *, since: str, until: str, on_skip: Callable[[], None] | None = None
) -> Iterator[str]:
    lo, hi = datetime.fromisoformat(since), datetime.fromisoformat(until)
    inside = False
    for line in lines:
        ts = leading_timestamp(line)
        if ts is not None:
            inside = lo <= ts <= hi
        if inside:
            yield line
        elif on_skip:
            on_skip()
