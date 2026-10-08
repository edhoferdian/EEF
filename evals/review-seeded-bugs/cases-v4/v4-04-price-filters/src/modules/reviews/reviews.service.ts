import { db } from "../../db";
import { Page } from "../../pagination";

export const reviewService = {
  list(storeId: string, p: Page) {
    return db.review.findMany({ where: { storeId, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.review.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  remove(storeId: string, id: string) {
    return db.review.updateMany({ where: { id, storeId, deletedAt: null }, data: { deletedAt: new Date() } });
  },
  create(storeId: string, data: { body: string }) {
    return db.review.create({ data: { ...data, storeId, status: "pending" } });
  },
};

export type ReviewService = typeof reviewService;
