// Every tenant has its own sequence of invoice ids, starting at 1, so the
// same invoiceId exists in many tenants. An invoice is identified globally
// only by the pair (tenantId, invoiceId).
export interface InvoiceRef {
  tenantId: string;
  invoiceId: number;
}
