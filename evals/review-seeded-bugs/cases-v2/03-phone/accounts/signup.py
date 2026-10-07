from .models import User
from .phone import normalize_phone


def sign_up(form: dict) -> User | dict:
    """Create an account from the signup form, or return field errors."""
    errors = {}
    if "@" not in form.get("email", ""):
        errors["email"] = "enter a valid email address"
    try:
        phone = normalize_phone(form.get("phone", ""))
    except ValueError as exc:
        errors["phone"] = str(exc)
    if errors:
        return {"errors": errors}
    return User.create(email=form["email"], phone=phone)
