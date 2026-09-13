import { UploadForm } from "../../../components/documents/upload-form";
import { requireSession } from "../../../server/auth/service";

export default async function UploadPage() {
  await requireSession();

  return (
    <>
      <header className="page-heading">
        <h1>Upload documents</h1>
        <p>
          Keep the original document intact while adding it to your private
          archive.
        </p>
      </header>
      <UploadForm />
    </>
  );
}
