import { db } from "../../db";
import { Page } from "../../pagination";

export const invoiceService = {
  list(storeId: string, p: Page) {
    return db.invoice.findMany({ where: { storeId, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.invoice.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  remove(storeId: string, id: string) {
    return db.invoice.updateMany({ where: { id, storeId, deletedAt: null }, data: { deletedAt: new Date() } });
  },
  create(storeId: string, data: { number: string }) {
    return db.invoice.create({ data: { ...data, storeId, status: "open" } });
  },
};

export type InvoiceService = typeof invoiceService;
