from sqlalchemy import Column, ForeignKey, Integer, String

from .db import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True)
    number = Column(String(16), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
