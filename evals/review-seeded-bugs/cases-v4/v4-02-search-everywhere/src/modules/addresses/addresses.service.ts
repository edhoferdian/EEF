import { db } from "../../db";
import { Page } from "../../pagination";

export const addressService = {
  list(storeId: string, p: Page, sort: string = "createdAt") {
    return db.address.findMany({ where: { storeId, deletedAt: null }, orderBy: { [sort]: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.address.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  create(storeId: string, data: { line1: string }) {
    return db.address.create({ data: { ...data, storeId, status: "active" } });
  },
};

export type AddressService = typeof addressService;
