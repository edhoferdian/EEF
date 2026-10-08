import { db } from "../../db";
import { Page } from "../../pagination";

export const addressService = {
  list(storeId: string, p: Page) {
    return db.address.findMany({ where: { storeId, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.address.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  byStatus(storeId: string, status: string, p: Page) {
    return db.address.findMany({ where: { storeId, status, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  create(storeId: string, data: { line1: string }) {
    return db.address.create({ data: { ...data, storeId, status: "active" } });
  },
};

export type AddressService = typeof addressService;
