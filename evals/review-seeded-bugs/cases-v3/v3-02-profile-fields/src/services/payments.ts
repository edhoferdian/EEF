import { gateway } from "./gateway";

export class PaymentDeclined extends Error {}

export const payments = {
  async charge(userId: string, amount: number): Promise<string> {
    const result = await gateway.charge({ customer: userId, amountCents: amount });
    if (result.status === "declined") throw new PaymentDeclined(result.reason);
    return result.id;
  },
  async refund(chargeId: string, amount: number): Promise<void> {
    await gateway.refund({ charge: chargeId, amountCents: amount });
  },
};
