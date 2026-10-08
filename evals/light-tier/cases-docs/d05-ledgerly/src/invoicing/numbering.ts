import { db } from "../db";

export async function nextInvoiceNumber(storeId: string): Promise<string> {
  const counter = await db.invoiceCounter.upsert({
    where: { storeId },
    create: { storeId, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${storeId}-${String(counter.value).padStart(6, "0")}`;
}
