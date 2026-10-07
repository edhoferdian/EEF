import requests

from .retry import with_retries

API = "https://api.payprovider.example/v1"


def create_charge(api_key: str, customer_id: str, amount_cents: int, currency: str = "IDR") -> dict:
    """Charge a saved customer and return the provider's charge object."""

    def call():
        resp = requests.post(
            f"{API}/charges",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"customer": customer_id, "amount": amount_cents, "currency": currency},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()

    return with_retries(call)
