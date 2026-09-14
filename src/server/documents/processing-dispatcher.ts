import "server-only";

import { after } from "next/server";

import { getBackgroundProcessingService } from "./background-processing-runtime";
import { logError } from "../observability/logger";

/** Schedules durable task recovery without extending an authenticated response. */
export function dispatchDueDocumentProcessing(): void {
  after(async () => {
    try {
      await getBackgroundProcessingService().runDueTasks();
    } catch (error) {
      // The persisted task remains due for the next authenticated request.
      logError("processing.dispatch_failed", error);
    }
  });
}
