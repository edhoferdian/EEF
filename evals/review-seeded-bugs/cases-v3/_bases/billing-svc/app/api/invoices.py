from flask import Blueprint, jsonify

from ..auth import current_account
from ..db import Session
from ..models import Invoice

bp = Blueprint("invoices", __name__)


@bp.get("/invoices")
def list_invoices():
    with Session() as s:
        rows = s.query(Invoice).filter(Invoice.account_id == current_account()).order_by(Invoice.id.desc()).limit(100)
        return jsonify([{"id": i.id, "total": str(i.total), "due_on": i.due_on.isoformat()} for i in rows])
