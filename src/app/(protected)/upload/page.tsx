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
        "אנדרואיד שלח שיתוף שהיישום לא הצליח לקרוא. במקום זאת אפשר להוסיף את הקובץ למטה.",
      title: "לא ניתן היה לקרוא את השיתוף",
    };
  }

  if (reason === "empty") {
    return {
      description:
        "השיתוף הגיע ליישום אך לא כלל קובץ. יש אפליקציות שמשתפות קישור במקום את הקובץ עצמו — נסו לשתף מתוך 'קבצים', או הוסיפו את הקובץ למטה.",
      title: "לא שותפו קבצים",
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
