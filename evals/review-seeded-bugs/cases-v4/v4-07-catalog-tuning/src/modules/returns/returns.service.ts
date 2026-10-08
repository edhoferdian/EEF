import { db } from "../../db";
import { Page } from "../../pagination";

export const returnRequestService = {
  list(storeId: string, p: Page) {
    return db.returnRequest.findMany({ where: { storeId, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.returnRequest.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  search(storeId: string, q: string, p: Page) {
    return db.returnRequest.findMany({ where: { storeId, deletedAt: null, reason: { contains: q, mode: "insensitive" } }, ...p });
  },
  create(storeId: string, data: { reason: string }) {
    return db.returnRequest.create({ data: { ...data, storeId, status: "requested" } });
  },
};

export type ReturnRequestService = typeof returnRequestService;
