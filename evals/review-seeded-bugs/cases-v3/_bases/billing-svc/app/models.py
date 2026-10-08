from sqlalchemy import Column, Date, ForeignKey, Integer, Numeric, String

from .db import Base


class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(320), nullable=False)


class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True)
    account_id = Column(Integer, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    subtotal = Column(Numeric(14, 2), nullable=False)
    tax = Column(Numeric(14, 2), nullable=False)
    total = Column(Numeric(14, 2), nullable=False)
    due_on = Column(Date, nullable=False)


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"
    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    description = Column(String(300), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
