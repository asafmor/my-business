import { UploadForm } from "../../../components/documents/upload-form";
import { SharedUploads } from "../../../components/uploads/shared-uploads";
import { ContentState } from "../../../components/ui/content-state";
import { decodeSharedUploads } from "../../../domain/documents/shared-upload";
import { requireSession } from "../../../server/auth/service";

type Params = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function all(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

/*
 * Only a share that carried nothing needs a notice of its own. Anything that
 * did arrive is in the upload tray, refusals included.
 */
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

  return null;
}

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireSession();

  const params = await searchParams;
  const notice = shareNotice(params);

  return (
    <>
      {notice ? <ContentState tone="error" {...notice} /> : null}
      <SharedUploads results={decodeSharedUploads(all(params.shared))} />
      <UploadForm />
    </>
  );
}
