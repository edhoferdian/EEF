from flask import Blueprint, abort, jsonify, request

from ..auth import current_account
from ..db import Session
from ..models import Customer

bp = Blueprint("customers", __name__)


@bp.get("/customers/<int:customer_id>")
def get_customer(customer_id: int):
    with Session() as s:
        c = s.query(Customer).filter(Customer.id == customer_id, Customer.account_id == current_account()).first()
        if c is None:
            abort(404)
        return jsonify({"id": c.id, "name": c.name, "email": c.email})


@bp.get("/customers")
def search_customers():
    q = (request.args.get("q") or "").strip()
    if len(q) < 2:
        abort(400, "q must be at least 2 characters")
    with Session() as s:
        rows = s.query(Customer).filter(Customer.name.ilike(f"%{q}%")).order_by(Customer.name).limit(25)
        return jsonify([{"id": c.id, "name": c.name, "email": c.email} for c in rows])
