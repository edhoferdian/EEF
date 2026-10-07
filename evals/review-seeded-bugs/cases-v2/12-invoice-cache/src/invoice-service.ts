import { remember } from "./cache";
import { db } from "./db";
import { InvoiceRef } from "./tenancy";

export interface InvoiceSummary {
  number: string;
  lines: number;
  totalCents: number;
}

export async function getInvoiceSummary(ref: InvoiceRef): Promise<InvoiceSummary> {
  const key = `invoice-summary:${ref.tenantId}:${ref.invoiceId}`;
  return remember(key, 300, async () => {
    const invoice = await db.invoice.findUniqueOrThrow({
      where: { tenantId_invoiceId: { tenantId: ref.tenantId, invoiceId: ref.invoiceId } },
    });
    return { number: invoice.number, lines: invoice.lineCount, totalCents: invoice.totalCents };
  });
}
