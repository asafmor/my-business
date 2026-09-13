import { ProtectedPlaceholderPage } from "../../components/layout/protected-placeholder-page";
import { requireSession } from "../../server/auth/service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireSession();

  return (
    <ProtectedPlaceholderPage
      description="A focused view of your current bookkeeping will live here."
      title="Dashboard"
    />
  );
}
