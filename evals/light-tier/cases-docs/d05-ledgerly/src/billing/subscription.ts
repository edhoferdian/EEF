import { db } from "../db";

export async function startSubscription(customerId: string, planId: string) {
  return db.subscription.create({ data: { customerId, planId, status: "active" } });
}

export async function cancelSubscription(id: string) {
  return db.subscription.update({ where: { id }, data: { cancelAtPeriodEnd: true } });
}
