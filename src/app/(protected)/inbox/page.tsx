import { ProtectedPlaceholderPage } from "../../../components/layout/protected-placeholder-page";
import { requireSession } from "../../../server/auth/service";

export default async function InboxPage() {
  await requireSession();

  return (
    <ProtectedPlaceholderPage
      description="Documents that need review or are still processing will appear here."
      title="Inbox"
    />
  );
}
