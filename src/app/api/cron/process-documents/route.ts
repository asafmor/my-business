import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getBackgroundProcessingService } from "../../../../server/documents/background-processing-runtime";

export const maxDuration = 60;

function hasValidCronAuthorization(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const supplied = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!hasValidCronAuthorization(request)) {
    return NextResponse.json(
      { message: "Request was rejected." },
      { status: 401 },
    );
  }

  const processed = await getBackgroundProcessingService().runDueTasks();
  return NextResponse.json({ processed });
}
