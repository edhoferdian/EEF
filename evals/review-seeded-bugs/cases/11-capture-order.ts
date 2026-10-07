import { stripe } from "./stripe";
import { orders } from "./orders-repo";
import { logger } from "./logger";

export async function captureOrder(orderId: string): Promise<void> {
  const order = await orders.get(orderId);
  if (order.status !== "authorized") {
    throw new Error(`order ${orderId} is ${order.status}, expected authorized`);
  }
  try {
    await stripe.paymentIntents.capture(order.paymentIntentId);
  } catch (err) {
    logger.warn({ err, orderId }, "capture failed");
  }
  await orders.update(orderId, { status: "paid", paidAt: new Date() });
  await orders.enqueueFulfillment(orderId);
}
