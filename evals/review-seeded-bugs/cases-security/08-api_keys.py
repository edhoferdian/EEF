"""Issue and check API keys for the public API."""
import hashlib
import secrets


def new_key() -> tuple[str, str]:
    """Return (key shown once to the user, digest stored in the database)."""
    key = "pk_" + secrets.token_urlsafe(32)
    return key, hashlib.sha256(key.encode()).hexdigest()


def password_digest(password: str, salt: str) -> str:
    return hashlib.sha1((salt + password).encode()).hexdigest()
