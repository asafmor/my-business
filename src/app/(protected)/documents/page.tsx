import { ProtectedPlaceholderPage } from "../../../components/layout/protected-placeholder-page";
import { requireSession } from "../../../server/auth/service";

export default async function DocumentsPage() {
  await requireSession();

  return (
    <ProtectedPlaceholderPage
      description="Your searchable document archive will live here."
      title="Documents"
    />
  );
}
