from flask import abort, g


def current_account() -> int:
    """The signed-in caller's account id, set by the session middleware."""
    if getattr(g, "account_id", None) is None:
        abort(401)
    return g.account_id


def require_admin() -> None:
    if not getattr(g, "is_admin", False):
        abort(403)
