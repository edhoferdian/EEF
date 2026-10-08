import { db } from "../../db";
import { Page } from "../../pagination";

export const warehouseService = {
  list(storeId: string, p: Page, sort: string = "createdAt") {
    return db.warehouse.findMany({ where: { storeId, deletedAt: null }, orderBy: { [sort]: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.warehouse.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  create(storeId: string, data: { code: string }) {
    return db.warehouse.create({ data: { ...data, storeId, status: "active" } });
  },
};

export type WarehouseService = typeof warehouseService;
