import { db } from "../../db";
import { Page } from "../../pagination";

export const bannerService = {
  list(storeId: string, p: Page) {
    return db.banner.findMany({ where: { storeId, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.banner.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  byStatus(storeId: string, status: string, p: Page) {
    return db.banner.findMany({ where: { storeId, status, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  create(storeId: string, data: { headline: string }) {
    return db.banner.create({ data: { ...data, storeId, status: "scheduled" } });
  },
};

export type BannerService = typeof bannerService;
