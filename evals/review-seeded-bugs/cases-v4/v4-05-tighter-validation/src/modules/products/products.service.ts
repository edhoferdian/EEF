import { db } from "../../db";
import { Page } from "../../pagination";

export const productService = {
  list(storeId: string, p: Page, sort: string = "createdAt") {
    return db.product.findMany({ where: { storeId, deletedAt: null }, orderBy: { [sort]: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.product.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  create(storeId: string, data: { name: string }) {
    return db.product.create({ data: { ...data, storeId, status: "draft" } });
  },
};

export type ProductService = typeof productService;
