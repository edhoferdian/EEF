import { db } from "../db";

export class OutOfStock extends Error {}

export interface Reservation {
  id: string;
  items: { productId: string; qty: number }[];
}

export const inventory = {
  async reserve(items: { productId: string; qty: number }[]): Promise<Reservation> {
    if (!items.every((i) => Number.isInteger(i.qty) && i.qty > 0)) throw new RangeError("qty must be a positive integer");
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
    await db.$transaction(async (tx) => {
      for (const item of reservation.items) {
        await tx.stock.update({ where: { productId: item.productId }, data: { available: { increment: item.qty } } });
      }
      await tx.reservation.delete({ where: { id: reservation.id } });
    });
  },
  async available(productId: string): Promise<number> {
    const stock = await db.stock.findUnique({ where: { productId } });
    return stock?.available ?? 0;
  },
};
