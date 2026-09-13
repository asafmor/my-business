import "server-only";

import { after } from "next/server";

import { getBackgroundProcessingService } from "./background-processing-runtime";

/** Schedules durable task recovery without extending an authenticated response. */
export function dispatchDueDocumentProcessing(): void {
  after(async () => {
    try {
      await getBackgroundProcessingService().runDueTasks();
    } catch {
      // The persisted task remains due for the next authenticated request.
    }
  });
}
