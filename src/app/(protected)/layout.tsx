import type { ReactNode } from "react";

import { AppShell } from "../../components/layout/app-shell";
import { requireSession } from "../../server/auth/service";
import { dispatchDueDocumentProcessing } from "../../server/documents/processing-dispatcher";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireSession();
  dispatchDueDocumentProcessing();

  return <AppShell>{children}</AppShell>;
}
