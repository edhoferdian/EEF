import { db } from "../db";
import { nextInvoiceNumber } from "./numbering";

export async function createInvoice(order: { id: string; storeId: string; totalCents: number }) {
  const number = await nextInvoiceNumber(order.storeId);
  return db.invoice.create({ data: { orderId: order.id, number, totalCents: order.totalCents, status: "draft" } });
}

export async function voidInvoice(id: string) {
  return db.invoice.update({ where: { id, status: { not: "paid" } }, data: { status: "void" } });
}

export async function markPaid(id: string, paidAt: Date) {
  return db.invoice.update({ where: { id }, data: { status: "paid", paidAt } });
}
