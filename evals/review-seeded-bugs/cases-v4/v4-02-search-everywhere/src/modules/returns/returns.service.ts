import { db } from "../../db";
import { Page } from "../../pagination";

export const returnRequestService = {
  list(storeId: string, p: Page) {
    return db.returnRequest.findMany({ where: { storeId, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.returnRequest.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  byStatus(storeId: string, status: string, p: Page) {
    return db.returnRequest.findMany({ where: { storeId, status, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  create(storeId: string, data: { reason: string }) {
    return db.returnRequest.create({ data: { ...data, storeId, status: "requested" } });
  },
};

export type ReturnRequestService = typeof returnRequestService;
