import { NextResponse } from "next/server";
import { z } from "zod";

import {
  RequestGuardError,
  parseProtectedMutation,
} from "../../../../../server/auth/guards";
import { getBackgroundProcessingService } from "../../../../../server/documents/background-processing-runtime";
import { dispatchDueDocumentProcessing } from "../../../../../server/documents/processing-dispatcher";

const retryRequestSchema = z.object({ documentId: z.string().uuid() });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { input } = await parseProtectedMutation(request, retryRequestSchema);
    const queued = await getBackgroundProcessingService().retry(
      input.documentId,
    );
    if (queued) dispatchDueDocumentProcessing();
    return NextResponse.json({ queued });
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
