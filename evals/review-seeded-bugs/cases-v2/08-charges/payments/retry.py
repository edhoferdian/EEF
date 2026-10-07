import time


def with_retries(fn, attempts=3, base_delay=0.5):
    """Call fn, retrying on any exception (timeouts, connection resets, 5xx)."""
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception:
            if attempt == attempts:
                raise
            time.sleep(base_delay * 2 ** (attempt - 1))
