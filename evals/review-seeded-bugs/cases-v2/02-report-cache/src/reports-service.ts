import { remember } from "./cache";
import { db } from "./db";
import { ReportRef } from "./tenancy";

export interface ReportSummary {
  title: string;
  rows: number;
  total: number;
}

export async function getReportSummary(ref: ReportRef): Promise<ReportSummary> {
  return remember(`report-summary:${ref.reportId}`, 300, async () => {
    const report = await db.report.findUniqueOrThrow({
      where: { tenantId_reportId: { tenantId: ref.tenantId, reportId: ref.reportId } },
    });
    return { title: report.title, rows: report.rowCount, total: report.total };
  });
}
