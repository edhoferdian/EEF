import { db } from "../../db";
import { Page } from "../../pagination";

export const ticketService = {
  list(storeId: string, p: Page) {
    return db.ticket.findMany({ where: { storeId, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  get(storeId: string, id: string) {
    return db.ticket.findFirst({ where: { id, storeId, deletedAt: null } });
  },
  byStatus(storeId: string, status: string, p: Page) {
    return db.ticket.findMany({ where: { storeId, status, deletedAt: null }, orderBy: { createdAt: "desc" }, ...p });
  },
  create(storeId: string, data: { subject: string }) {
    return db.ticket.create({ data: { ...data, storeId, status: "open" } });
  },
};

export type TicketService = typeof ticketService;
