import { mailer } from "./mailer";

export const email = {
  async orderConfirmation(userId: string, orderId: string): Promise<void> {
    await mailer.send({ to: userId, template: "order-confirmation", data: { orderId } });
  },
  async shippingUpdate(userId: string, orderId: string, trackingUrl: string): Promise<void> {
    await mailer.send({ to: userId, template: "shipping-update", data: { orderId, trackingUrl } });
  },
};
