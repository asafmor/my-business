import { ProtectedPlaceholderPage } from "../../../components/layout/protected-placeholder-page";
import { requireSession } from "../../../server/auth/service";

export default async function ReportsPage() {
  await requireSession();

  return (
    <ProtectedPlaceholderPage
      description="Monthly summaries and exports will appear here."
      title="Reports"
    />
  );
}
