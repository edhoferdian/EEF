import { db } from "../../db";
import { Page } from "../../pagination";

export const couponService = {
  list(storeId: string, p: Page) {
    return db.coupon.findMany({ where: { storeId, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.coupon.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  create(storeId: string, data: { code: string }) {
    return db.coupon.create({ data: { ...data, storeId, status: "active" } });
  },
};

export type CouponService = typeof couponService;
