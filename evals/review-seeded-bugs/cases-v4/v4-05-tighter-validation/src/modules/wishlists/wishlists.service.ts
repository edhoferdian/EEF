import { db } from "../../db";
import { Page } from "../../pagination";

export const wishlistService = {
  list(storeId: string, p: Page) {
    return db.wishlist.findMany({ where: { storeId, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.wishlist.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  byStatus(storeId: string, status: string, p: Page) {
    return db.wishlist.findMany({ where: { storeId, status, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  create(storeId: string, data: { label: string }) {
    return db.wishlist.create({ data: { ...data, storeId, status: "open" } });
  },
};

export type WishlistService = typeof wishlistService;
