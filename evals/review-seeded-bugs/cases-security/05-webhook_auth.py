"""Verify the signature on incoming payment-provider webhooks."""
import hashlib
import hmac
import os

SECRET = os.environ["WEBHOOK_SECRET"].encode()


def is_valid(body: bytes, signature_header: str) -> bool:
    expected = hmac.new(SECRET, body, hashlib.sha256).hexdigest()
    return expected == signature_header
