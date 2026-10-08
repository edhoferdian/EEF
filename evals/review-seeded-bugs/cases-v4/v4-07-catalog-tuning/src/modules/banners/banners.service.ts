import { db } from "../../db";
import { Page } from "../../pagination";

export const bannerService = {
  list(storeId: string, p: Page, sort: string = "createdAt") {
    return db.banner.findMany({ where: { storeId, deletedAt: null }, orderBy: { [sort]: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.banner.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  create(storeId: string, data: { headline: string }) {
    return db.banner.create({ data: { ...data, storeId, status: "scheduled" } });
  },
};

export type BannerService = typeof bannerService;
