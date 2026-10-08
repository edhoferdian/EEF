import { db } from "../../db";
import { Page } from "../../pagination";

export const addressService = {
  list(storeId: string, p: Page) {
    return db.address.findMany({ where: { storeId, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.address.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  search(storeId: string, q: string, p: Page) {
    return db.address.findMany({ where: { storeId, deletedAt: null, line1: { contains: q, mode: "insensitive" } }, ...p });
  },
  create(storeId: string, data: { line1: string }) {
    return db.address.create({ data: { ...data, storeId, status: "active" } });
  },
};

export type AddressService = typeof addressService;
