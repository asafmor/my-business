import { NextResponse } from "next/server";

import { buildReportCsv } from "../../../../domain/reports/csv";
import { parseReportMonth } from "../../../../domain/reports/month";
import {
  RequestGuardError,
  requireRequestSession,
} from "../../../../server/auth/guards";
import { DrizzleMonthlyReportRepository } from "../../../../server/reports/monthly-report-repository";

const repository = new DrizzleMonthlyReportRepository();

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireRequestSession(request);
  } catch (error) {
    if (error instanceof RequestGuardError) {
      return NextResponse.json(
        { message: "Request was rejected." },
        { status: error.status },
      );
    }
    throw error;
  }

  const month = parseReportMonth(
    new URL(request.url).searchParams.get("month"),
  );
  const rows = await repository.csvRows(month);
  const csv = buildReportCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="expenses-${month}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
