import { db } from "../../db";
import { Page } from "../../pagination";

export const shipmentService = {
  list(storeId: string, p: Page) {
    return db.shipment.findMany({ where: { storeId, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.shipment.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  byStatus(storeId: string, status: string, p: Page) {
    return db.shipment.findMany({ where: { storeId, status, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  create(storeId: string, data: { trackingNo: string }) {
    return db.shipment.create({ data: { ...data, storeId, status: "pending" } });
  },
};

export type ShipmentService = typeof shipmentService;
