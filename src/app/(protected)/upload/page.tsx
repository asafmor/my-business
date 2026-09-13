import { ProtectedPlaceholderPage } from "../../../components/layout/protected-placeholder-page";
import { requireSession } from "../../../server/auth/service";

export default async function UploadPage() {
  await requireSession();

  return (
    <ProtectedPlaceholderPage
      description="The secure document upload flow is being prepared."
      title="Upload documents"
    />
  );
}
