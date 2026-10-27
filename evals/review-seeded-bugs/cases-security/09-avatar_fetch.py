"""Download a user's avatar from an allow-listed CDN."""
import ipaddress
import socket
import urllib.request
from urllib.parse import urlparse

ALLOWED_HOSTS = {"cdn.example-avatars.com"}


def fetch_avatar(url: str) -> bytes:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS:
        raise ValueError("avatar host not allowed")
    for info in socket.getaddrinfo(parsed.hostname, 443):
        if not ipaddress.ip_address(info[4][0]).is_global:
            raise ValueError("avatar host resolves to a private address")
    with urllib.request.urlopen(url, timeout=5) as resp:
        return resp.read(2_000_000)
