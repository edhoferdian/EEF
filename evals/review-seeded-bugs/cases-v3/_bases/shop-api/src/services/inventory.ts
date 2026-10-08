import { db } from "../db";

export class OutOfStock extends Error {}

export interface Reservation {
  id: string;
}

export const inventory = {
  async reserve(items: { productId: string; qty: number }[]): Promise<Reservation> {
    return db.$transaction(async (tx) => {
      for (const item of items) {
        const updated = await tx.stock.updateMany({
          where: { productId: item.productId, available: { gte: item.qty } },
          data: { available: { decrement: item.qty } },
        });
        if (updated.count === 0) throw new OutOfStock(`not enough stock for ${item.productId}`);
      }
      return tx.reservation.create({ data: { items } });
    });
  },
  async release(reservation: Reservation): Promise<void> {
    await db.reservation.delete({ where: { id: reservation.id } });
  },
};
