import { UploadForm } from "../../../components/documents/upload-form";
import { ContentState } from "../../../components/ui/content-state";
import { requireSession } from "../../../server/auth/service";

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function count(value: string | string[] | undefined): number {
  const parsed = Number(first(value));
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/* A share that lands here did not go cleanly, so it owes the user a reason. */
function shareNotice(params: Params) {
  const reason = first(params.share);

  if (reason === "unreadable") {
    return {
      description:
        "Android sent a share this app could not read. Add the file below instead.",
      title: "The share could not be read",
    };
  }

  if (reason === "empty") {
    return {
      description:
        "The share reached the app but carried no file. Some apps share a link instead of the file itself — try sharing from Files, or add the file below.",
      title: "No files were shared",
    };
  }

  const added = count(params.added);
  const failed = count(params.failed);
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
  searchParams: Promise<Params>;
}) {
  await requireSession();

  const params = await searchParams;
  const isShare = "share" in params || "added" in params || "failed" in params;
  const notice = isShare ? shareNotice(params) : null;

  return (
    <>
      {notice ? <ContentState tone="error" {...notice} /> : null}
      <UploadForm />
    </>
  );
}
