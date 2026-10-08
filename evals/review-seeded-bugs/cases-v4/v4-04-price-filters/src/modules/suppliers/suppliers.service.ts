import { db } from "../../db";
import { Page } from "../../pagination";

export const supplierService = {
  list(storeId: string, p: Page) {
    return db.supplier.findMany({ where: { storeId, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.supplier.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  byStatus(storeId: string, status: string, p: Page) {
    return db.supplier.findMany({ where: { storeId, status, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  create(storeId: string, data: { company: string }) {
    return db.supplier.create({ data: { ...data, storeId, status: "active" } });
  },
};

export type SupplierService = typeof supplierService;
