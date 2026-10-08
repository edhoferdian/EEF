import { db } from "../../db";
import { Page } from "../../pagination";

export const categoryService = {
  list(storeId: string, p: Page, sort: string = "createdAt") {
    return db.category.findMany({ where: { storeId, deletedAt: null }, orderBy: { [sort]: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.category.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  create(storeId: string, data: { title: string }) {
    return db.category.create({ data: { ...data, storeId, status: "visible" } });
  },
};

export type CategoryService = typeof categoryService;
