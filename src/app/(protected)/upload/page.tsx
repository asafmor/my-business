import { UploadForm } from "../../../components/documents/upload-form";
import { ContentState } from "../../../components/ui/content-state";
import { requireSession } from "../../../server/auth/service";

function count(value: string | string[] | undefined): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/* A share that lands here did not go cleanly, so it owes the user a reason. */
function shareNotice(added: number, failed: number) {
  if (added + failed === 0) {
    return {
      description:
        "Nothing supported arrived. Share a JPEG, PNG, WebP, or PDF, or add the file below.",
      title: "No files were shared",
    };
  }

  return {
    description:
      added === 0
        ? `${failed} shared ${failed === 1 ? "file was" : "files were"} refused. Only JPEG, PNG, WebP, and PDF up to 10 MB are accepted.`
        : `${added} of ${added + failed} shared files were added. The rest were refused; only JPEG, PNG, WebP, and PDF up to 10 MB are accepted.`,
    title:
      added === 0 ? "Shared files were not added" : "Some files were added",
  };
}

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();

  const params = await searchParams;
  const isShare = "added" in params || "failed" in params;
  const notice = isShare
    ? shareNotice(count(params.added), count(params.failed))
    : null;

  return (
    <>
      {notice ? <ContentState tone="error" {...notice} /> : null}
      <UploadForm />
    </>
  );
}
