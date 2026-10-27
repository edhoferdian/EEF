"""Restore a user's draft session from the cookie the browser sends back."""
import base64
import pickle


def save_draft(draft: dict) -> str:
    return base64.urlsafe_b64encode(pickle.dumps(draft)).decode("ascii")


def restore_draft(cookie_value: str) -> dict:
    if not cookie_value:
        return {}
    data = base64.urlsafe_b64decode(cookie_value.encode("ascii"))
    draft = pickle.loads(data)
    return draft if isinstance(draft, dict) else {}
