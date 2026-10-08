from flask import Blueprint, abort, jsonify

from ..auth import current_account
from ..db import Session
from ..models import Invoice

bp = Blueprint("invoices", __name__)


def _summary(i: Invoice) -> dict:
    return {"id": i.id, "total": str(i.total), "due_on": i.due_on.isoformat()}


@bp.get("/invoices")
def list_invoices():
    with Session() as s:
        rows = s.query(Invoice).filter(Invoice.account_id == current_account()).order_by(Invoice.id.desc()).limit(100)
        return jsonify([_summary(i) for i in rows])


@bp.get("/invoices/<int:invoice_id>")
def get_invoice(invoice_id: int):
    with Session() as s:
        i = s.query(Invoice).filter(Invoice.id == invoice_id, Invoice.account_id == current_account()).first()
        if i is None:
            abort(404)
        return jsonify(_summary(i) | {"subtotal": str(i.subtotal), "tax": str(i.tax)})
