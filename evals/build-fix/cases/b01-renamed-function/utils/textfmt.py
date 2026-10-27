import re


def slugify_title(title: str) -> str:
    """Lowercase, ASCII-only, words joined by hyphens."""
    words = re.findall(r"[a-z0-9]+", title.lower())
    return "-".join(words)
