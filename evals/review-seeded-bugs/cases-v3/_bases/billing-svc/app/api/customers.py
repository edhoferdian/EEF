from flask import Blueprint, abort, jsonify

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
