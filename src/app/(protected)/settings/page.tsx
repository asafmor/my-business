import { ProtectedPlaceholderPage } from "../../../components/layout/protected-placeholder-page";
import { requireSession } from "../../../server/auth/service";

export default async function SettingsPage() {
  await requireSession();

  return (
    <ProtectedPlaceholderPage
      description="Application settings and future integrations will appear here."
      title="Settings"
    />
  );
}
