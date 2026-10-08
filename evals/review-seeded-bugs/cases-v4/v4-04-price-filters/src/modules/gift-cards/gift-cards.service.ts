import { db } from "../../db";
import { Page } from "../../pagination";

export const giftCardService = {
  list(storeId: string, p: Page) {
    return db.giftCard.findMany({ where: { storeId, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.giftCard.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  count(storeId: string) {
    return db.giftCard.count({ where: { storeId, deletedAt: null } });
  },
  create(storeId: string, data: { code: string }) {
    return db.giftCard.create({ data: { ...data, storeId, status: "active" } });
  },
};

export type GiftCardService = typeof giftCardService;
