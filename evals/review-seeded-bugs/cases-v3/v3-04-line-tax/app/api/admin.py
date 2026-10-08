from flask import Blueprint, jsonify

from ..auth import current_account, require_admin
from ..db import Session
from ..models import Invoice

bp = Blueprint("admin", __name__)


@bp.get("/admin/overdue")
def overdue_count():
    require_admin()
    from datetime import date

    with Session() as s:
        n = s.query(Invoice).filter(Invoice.account_id == current_account(), Invoice.due_on < date.today()).count()
        return jsonify({"overdue": n})
