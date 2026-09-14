"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseReportMonth } from "../../../domain/reports/month";
import { getMonthlyReportGenerator } from "../../../server/reports/generate-monthly-report";
import { requireSession } from "../../../server/auth/service";
import { logError } from "../../../server/observability/logger";

export async function generateReportAction(formData: FormData): Promise<void> {
  await requireSession();
  const month = parseReportMonth(formData.get("month")?.toString());

  try {
    await getMonthlyReportGenerator().generatePdf(month);
  } catch (error) {
    logError("report.generation_failed", error, { month });
    throw error;
  }

  revalidatePath("/reports");
  redirect(`/reports?month=${month}`);
}
