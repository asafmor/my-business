import { NextResponse } from "next/server";
import { z } from "zod";

import {
  RequestGuardError,
  parseProtectedMutation,
} from "../../../../../server/auth/guards";
import { getBackgroundProcessingService } from "../../../../../server/documents/background-processing-runtime";

const statusRequestSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(50),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { input } = await parseProtectedMutation(
      request,
      statusRequestSchema,
    );
    const documents =
      await getBackgroundProcessingService().getDocumentStatuses(
        input.documentIds,
      );
    return NextResponse.json({ documents });
  } catch (error) {
    if (error instanceof RequestGuardError) {
      return NextResponse.json(
        { message: "Request was rejected." },
        { status: error.status },
      );
    }
    throw error;
  }
}
