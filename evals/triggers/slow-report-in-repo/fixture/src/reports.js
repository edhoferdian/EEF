export async function buildReport(db) {
  const orders = await db.query('SELECT * FROM orders');
  return orders.map((o) => ({
    ...o,
    customerOrderCount: orders.filter((x) => x.customer_id === o.customer_id).length,
    customer: db.query('SELECT * FROM customers WHERE id = $1', [o.customer_id]),
  }));
}
