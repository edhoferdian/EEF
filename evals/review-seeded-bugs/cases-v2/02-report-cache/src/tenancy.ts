// Every tenant has its own sequence of report ids, starting at 1, so the
// same reportId exists in many tenants. A report is identified globally
// only by the pair (tenantId, reportId).
export interface ReportRef {
  tenantId: string;
  reportId: number;
}
