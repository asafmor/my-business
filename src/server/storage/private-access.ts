import "server-only";

import { requireProtectedOperation } from "../auth/guards";

import type { Session } from "../../lib/auth-session";

import type { ObjectKey } from "./object-keys";
import type { ObjectStorage, SignedReadUrl } from "./object-storage";

export type ReadAuthorization = {
  authorize(session: Session): Promise<void> | void;
  key: ObjectKey;
};

// Callers use authorize to verify the document/report record before any URL exists.
export async function createPrivateReadUrl(
  storage: ObjectStorage,
  authorization: ReadAuthorization,
): Promise<SignedReadUrl> {
  const session = await requireProtectedOperation();
  await authorization.authorize(session);
  return storage.createSignedReadUrl(authorization.key);
}
