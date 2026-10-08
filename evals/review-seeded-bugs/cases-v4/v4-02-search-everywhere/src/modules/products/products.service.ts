import { db } from "../../db";
import { Page } from "../../pagination";

export const productService = {
  list(storeId: string, p: Page) {
    return db.product.findMany({ where: { storeId, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.product.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  byStatus(storeId: string, status: string, p: Page) {
    return db.product.findMany({ where: { storeId, status, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  create(storeId: string, data: { name: string }) {
    return db.product.create({ data: { ...data, storeId, status: "draft" } });
  },
};

export type ProductService = typeof productService;
