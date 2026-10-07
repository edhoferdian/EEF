import time
from threading import Lock


class TTLCache:
    """Small in-process cache; entries expire ttl seconds after being set."""

    def __init__(self, ttl: float = 60.0):
        self._ttl = ttl
        self._data: dict[str, tuple[float, object]] = {}
        self._lock = Lock()

    def set(self, key: str, value: object) -> None:
        with self._lock:
            self._data[key] = (time.monotonic() + self._ttl, value)

    def get(self, key: str, default=None):
        with self._lock:
            entry = self._data.get(key)
            if entry is None or entry[0] < time.monotonic():
                return default
            return entry[1]

    def purge_expired(self) -> int:
        now = time.monotonic()
        removed = 0
        with self._lock:
            for key, (expires_at, _) in self._data.items():
                if expires_at < now:
                    del self._data[key]
                    removed += 1
        return removed
