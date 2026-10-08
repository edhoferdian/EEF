export async function charge(orderId: string, amount: number) {
  const res = await fetch(`${process.env.PAY_URL}/charges`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderId, amount }),
  });
  if (!res.ok) throw new Error('payment failed');
  return res.json();
}
