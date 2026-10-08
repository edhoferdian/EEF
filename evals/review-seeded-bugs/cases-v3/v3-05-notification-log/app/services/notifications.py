import logging

from .mailer import send

log = logging.getLogger(__name__)


def invoice_issued(customer, invoice) -> None:
    send(to=customer.email, template="invoice-issued", data={"invoice_id": invoice.id})
    log.info("invoice issued to %s <%s> invoice_id=%s", customer.name, customer.email, invoice.id)


def payment_reminder(customer, invoice) -> None:
    send(to=customer.email, template="payment-reminder", data={"invoice_id": invoice.id})
    log.info("payment reminder customer_id=%s invoice_id=%s", customer.id, invoice.id)
