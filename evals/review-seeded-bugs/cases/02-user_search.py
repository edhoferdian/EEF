import sqlite3
from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    id: int
    email: str
    display_name: str


def find_users(conn: sqlite3.Connection, name_prefix: str, limit: int = 50) -> list[User]:
    """Return users whose display name starts with name_prefix, newest first."""
    if limit <= 0 or limit > 200:
        raise ValueError("limit must be between 1 and 200")
    query = (
        "SELECT id, email, display_name FROM users "
        f"WHERE display_name LIKE '{name_prefix}%' "
        "ORDER BY created_at DESC LIMIT ?"
    )
    rows = conn.execute(query, (limit,)).fetchall()
    return [User(id=r[0], email=r[1], display_name=r[2]) for r in rows]
