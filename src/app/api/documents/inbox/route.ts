import { NextResponse } from "next/server";

import { attentionReasons } from "../../../../domain/documents/attention-reasons";
import type { DocumentStatus } from "../../../../domain/documents/types";
import {
  RequestGuardError,
  requireRequestSession,
} from "../../../../server/auth/guards";
import {
  DrizzleInboxQueryRepository,
  type InboxRow,
} from "../../../../server/documents/inbox-query-repository";

export type InboxBacklogRow = {
  categoryName: string | null;
  currency: string | null;
  id: string;
  reasons: string[];
  status: DocumentStatus;
  supplierName: string | null;
  total: string | null;
  transactionDate: string | null;
};

export type InboxBacklogResponse = {
  failed: InboxBacklogRow[];
  needsReview: InboxBacklogRow[];
  processing: InboxBacklogRow[];
  recentlyCompleted: InboxBacklogRow[];
};

const repository = new DrizzleInboxQueryRepository();

// The tray shows a slice, not the full Inbox archive the page used to.
const backlogLimitPerSection = 10;

function project(rows: InboxRow[]): InboxBacklogRow[] {
  return rows.map((row) => ({
    categoryName: row.categoryName,
    currency: row.currency,
    id: row.id,
    reasons: attentionReasons(row),
    status: row.status,
    supplierName: row.supplierName,
    total: row.total,
    transactionDate: row.transactionDate,
  }));
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireRequestSession(request);
  } catch (error) {
    if (error instanceof RequestGuardError) {
      return NextResponse.json(
        { message: "Request was rejected." },
        { status: error.status },
      );
    }
    throw error;
  }

  const inbox = await repository.list(backlogLimitPerSection);
  const response: InboxBacklogResponse = {
    failed: project(inbox.failed),
    needsReview: project(inbox.needsReview),
    processing: project(inbox.processing),
    recentlyCompleted: project(inbox.recentlyCompleted),
  };

  return NextResponse.json(response);
}
