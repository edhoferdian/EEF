import { charge } from '../payment/client';

export async function checkout(order: { id: string; total: number }) {
  const receipt = await charge(order.id, order.total);
  return { ...order, paid: true, receipt };
}
