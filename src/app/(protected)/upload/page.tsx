import { UploadForm } from "../../../components/documents/upload-form";
import { requireSession } from "../../../server/auth/service";

export default async function UploadPage() {
  await requireSession();

  return (
    <>
      <UploadForm />
    </>
  );
}
