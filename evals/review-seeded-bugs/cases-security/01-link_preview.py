"""Fetch a page title for link previews shown in chat messages."""
import re
import urllib.request

TITLE = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def fetch_preview(url: str) -> dict:
    if not url.startswith(("http://", "https://")):
        raise ValueError("unsupported scheme")
    with urllib.request.urlopen(url, timeout=5) as resp:
        body = resp.read(65536).decode("utf-8", errors="replace")
    match = TITLE.search(body)
    return {"url": url, "title": match.group(1).strip() if match else None}
