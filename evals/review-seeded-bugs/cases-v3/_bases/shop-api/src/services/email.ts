import { mailer } from "./mailer";

export const email = {
  async orderConfirmation(userId: string, orderId: string): Promise<void> {
    await mailer.send({ to: userId, template: "order-confirmation", data: { orderId } });
  },
};
