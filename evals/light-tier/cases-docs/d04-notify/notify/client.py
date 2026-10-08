import time

import httpx


class DeliveryError(Exception):
    pass


class Client:
    def __init__(self, webhook_url: str) -> None:
        self.webhook_url = webhook_url

    def send(self, message: str, *, max_retries: int = 3, timeout: float = 10.0) -> None:
        for attempt in range(max_retries + 1):
            r = httpx.post(self.webhook_url, json={"text": message}, timeout=timeout)
            if r.status_code < 500:
                r.raise_for_status()
                return
            time.sleep(2 ** attempt)
        raise DeliveryError(f"gave up after {max_retries} retries")
