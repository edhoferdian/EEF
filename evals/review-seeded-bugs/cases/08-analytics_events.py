from datetime import datetime, timezone


def build_event(name: str, payload: dict, tags: list[str] = []) -> dict:
    """Build an analytics event. Every event is tagged with its source."""
    tags.append("source:web")
    return {
        "name": name,
        "payload": payload,
        "tags": tags,
        "ts": datetime.now(timezone.utc).isoformat(),
    }


def track_signup(user_id: str) -> dict:
    return build_event("signup", {"user_id": user_id})


def track_purchase(user_id: str, amount_cents: int) -> dict:
    return build_event("purchase", {"user_id": user_id, "amount_cents": amount_cents}, ["paid"])
