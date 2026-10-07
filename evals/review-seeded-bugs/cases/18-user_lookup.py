import sqlite3
from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    id: int
    email: str
    display_name: str


def find_by_email_domain(conn: sqlite3.Connection, domain: str, limit: int = 50) -> list[User]:
    """Return users whose email is on the given domain, newest first."""
    if not domain or "@" in domain:
        raise ValueError("domain must be a bare domain such as example.com")
    if limit <= 0 or limit > 200:
        raise ValueError("limit must be between 1 and 200")
    escaped = domain.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    rows = conn.execute(
        "SELECT id, email, display_name FROM users "
        "WHERE email LIKE ? ESCAPE '\\' "
        "ORDER BY created_at DESC LIMIT ?",
        (f"%@{escaped}", limit),
    ).fetchall()
    return [User(id=r[0], email=r[1], display_name=r[2]) for r in rows]
