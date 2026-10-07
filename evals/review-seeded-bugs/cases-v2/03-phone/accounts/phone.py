import re

_NON_DIGITS = re.compile(r"\D+")


def normalize_phone(raw: str, default_country: str = "62") -> str | None:
    """Normalize a phone number to E.164, e.g. '0812-3456-789' -> '+628123456789'.

    Returns None when the input cannot be a valid number.
    """
    digits = _NON_DIGITS.sub("", raw or "")
    if digits.startswith("0"):
        digits = default_country + digits[1:]
    if not 8 <= len(digits) <= 15:
        return None
    return "+" + digits
