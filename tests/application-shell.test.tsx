import { Children, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  logout: vi.fn(),
  requireSession: vi.fn(),
}));
const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn(),
}));
const dispatcherMocks = vi.hoisted(() => ({
  dispatchDueDocumentProcessing: vi.fn(),
}));
const documentsQueryMocks = vi.hoisted(() => ({
  list: vi
    .fn()
    .mockResolvedValue({ page: 1, pageSize: 25, rows: [], total: 0 }),
  listActiveCategories: vi.fn().mockResolvedValue([]),
}));
const categoryRepositoryMocks = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue([]),
}));
const inboxQueryMocks = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue({
    failed: [],
    needsReview: [],
    processing: [],
    recentlyCompleted: [],
  }),
}));
const dashboardRepositoryMocks = vi.hoisted(() => ({
  categoryBreakdown: vi.fn().mockResolvedValue([]),
  hasAnyDocuments: vi.fn().mockResolvedValue(false),
  recentlyEdited: vi.fn().mockResolvedValue([]),
  recentlyUploaded: vi.fn().mockResolvedValue([]),
  summary: vi.fn().mockResolvedValue({
    documentCount: 0,
    needsReviewCount: 0,
    totalExpenses: "0",
    vatTotal: "0",
  }),
}));
const monthlyReportMocks = vi.hoisted(() => ({
  categoryBreakdown: vi.fn().mockResolvedValue([]),
  problematicDocuments: vi.fn().mockResolvedValue([]),
  summary: vi.fn().mockResolvedValue({
    documentCount: 0,
    grossTotal: "0",
    netTotal: "0",
    reviewProblemCount: 0,
    vatTotal: "0",
  }),
  supplierBreakdown: vi.fn().mockResolvedValue([]),
}));
const reportArtifactMocks = vi.hoisted(() => ({
  listForMonth: vi.fn().mockResolvedValue([]),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: navigationMocks.redirect,
  usePathname: () => "/documents",
}));
vi.mock("../src/server/auth/service", () => authMocks);
vi.mock("../src/server/documents/processing-dispatcher", () => dispatcherMocks);
vi.mock("../src/server/documents/background-processing-runtime", () => ({
  getBackgroundProcessingService: vi.fn(() => ({ retry: vi.fn() })),
}));
vi.mock("../src/server/documents/document-detail-repository", () => ({
  DrizzleDocumentDetailRepository: function DrizzleDocumentDetailRepository() {
    return { markReviewed: vi.fn(), saveEdit: vi.fn() };
  },
}));
vi.mock("../src/server/documents/documents-query-repository", () => ({
  DrizzleDocumentsQueryRepository: function DrizzleDocumentsQueryRepository() {
    return documentsQueryMocks;
  },
}));
vi.mock("../src/server/categories/category-repository", () => ({
  DrizzleCategoryRepository: function DrizzleCategoryRepository() {
    return categoryRepositoryMocks;
  },
}));
vi.mock("../src/server/documents/inbox-query-repository", () => ({
  DrizzleInboxQueryRepository: function DrizzleInboxQueryRepository() {
    return inboxQueryMocks;
  },
}));
vi.mock("../src/server/documents/dashboard-repository", () => ({
  DrizzleDashboardRepository: function DrizzleDashboardRepository() {
    return dashboardRepositoryMocks;
  },
}));
vi.mock("../src/server/reports/monthly-report-repository", () => ({
  DrizzleMonthlyReportRepository: function DrizzleMonthlyReportRepository() {
    return monthlyReportMocks;
  },
}));
vi.mock("../src/server/reports/report-artifact-repository", () => ({
  DrizzleReportArtifactRepository: function DrizzleReportArtifactRepository() {
    return reportArtifactMocks;
  },
}));
vi.mock("../src/server/storage/object-storage", () => ({
  getR2ObjectStorage: vi.fn(() => ({})),
}));
vi.mock("../src/server/settings/status", () => ({
  backupBadgeTone: () => "neutral",
  checkDatabaseStatus: vi.fn().mockResolvedValue({ detail: "ok", ok: true }),
  checkLastBackupStatus: vi
    .fn()
    .mockResolvedValue({ database: null, objects: null }),
  checkStorageConfiguration: vi.fn(() => ({ detail: "ok", ok: true })),
  statusBadgeTone: (ok: boolean) => (ok ? "success" : "error"),
}));
vi.mock("../src/server/storage/private-access", () => ({
  createPrivateReadUrl: vi.fn().mockResolvedValue({
    expiresAt: new Date(),
    url: "https://example.com/signed",
  }),
}));

import { logoutAction } from "../src/app/(protected)/actions";
import DashboardPage from "../src/app/(protected)/page";
import CategoriesPage from "../src/app/(protected)/categories/page";
import DocumentsPage from "../src/app/(protected)/documents/page";
import ProtectedLayout from "../src/app/(protected)/layout";
import ReportsPage from "../src/app/(protected)/reports/page";
import SettingsPage from "../src/app/(protected)/settings/page";
import UploadPage from "../src/app/(protected)/upload/page";
import {
  ApplicationNavigation,
  getNextDrawerFocusIndex,
  MobileNavigationDrawer,
  pageHeaderFor,
} from "../src/components/layout/app-shell";
import { ContentState } from "../src/components/ui/content-state";
import { SharedUploads } from "../src/components/uploads/shared-uploads";
import { UploadTrayProvider } from "../src/components/uploads/upload-tray-provider";

describe("protected application shell", () => {
  it("enforces a shared server session in the layout and every shell route", async () => {
    const pages = [DashboardPage, SettingsPage];

    renderToStaticMarkup(await ProtectedLayout({ children: <p>Content</p> }));
    await Promise.all(pages.map((Page) => Page()));
    await UploadPage({ searchParams: Promise.resolve({}) });
    await DocumentsPage({ searchParams: Promise.resolve({}) });
    await CategoriesPage();
    await ReportsPage({ searchParams: Promise.resolve({}) });

    expect(authMocks.requireSession).toHaveBeenCalledTimes(7);
    expect(
      dispatcherMocks.dispatchDueDocumentProcessing,
    ).toHaveBeenCalledOnce();
  });

  it("renders a semantic shell with upload, logout, and a skip link", async () => {
    const markup = renderToStaticMarkup(
      await ProtectedLayout({ children: <p>Workspace content</p> }),
    );

    expect(markup).toContain('href="#main-content"');
    expect(markup).toContain('id="main-content"');
    expect(markup).toContain('href="/upload"');
    expect(markup).toContain(">העלאה<");
    expect(markup).toContain('aria-label="התנתקות"');
    expect(markup).toContain('aria-label="מגש העלאות"');
  });

  it("gives mobile its own thumb-reachable navigation and capture action", async () => {
    const markup = renderToStaticMarkup(
      await ProtectedLayout({ children: <p>Workspace content</p> }),
    );

    expect(markup).toContain('aria-label="ניווט מהיר"');
    expect(markup).toContain('aria-label="העלאת מסמך"');
    expect(markup).toContain("tab-bar__capture");
  });
});

describe("application navigation", () => {
  it("marks exactly the matching navigation route as current", () => {
    const markup = renderToStaticMarkup(
      <ApplicationNavigation pathname="/documents/123" />,
    );

    expect(markup).toMatch(
      /aria-current="page" class="app-navigation__link is-current" title="מסמכים" href="\/documents"/,
    );
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toContain('href="/settings"');
  });

  it("titles the header from the route, longest prefix first", () => {
    expect(pageHeaderFor("/")).toMatchObject({ title: "לוח בקרה" });
    expect(pageHeaderFor("/documents")).toMatchObject({ title: "מסמכים" });
    expect(pageHeaderFor("/documents/abc")).toMatchObject({
      title: "מסמך",
    });
    expect(pageHeaderFor("/upload")).toMatchObject({
      title: "העלאת מסמכים",
    });
    expect(pageHeaderFor("/nowhere")).toMatchObject({ title: "העסק שלי" });
  });

  it("provides a labelled modal drawer and wraps keyboard focus", () => {
    const markup = renderToStaticMarkup(
      <MobileNavigationDrawer
        closeButtonRef={{ current: null }}
        drawerRef={{ current: null }}
        isOpen
        onClose={() => undefined}
        pathname="/documents"
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-label="סגירת הניווט"');
    expect(getNextDrawerFocusIndex(0, 4, true)).toBe(3);
    expect(getNextDrawerFocusIndex(3, 4, false)).toBe(0);
    expect(getNextDrawerFocusIndex(-1, 4, false)).toBe(0);
  });
});

describe("application UI states", () => {
  it("exposes accessible error and loading status patterns", () => {
    const errorMarkup = renderToStaticMarkup(
      <ContentState
        description="Try again."
        title="Unable to load"
        tone="error"
      />,
    );
    const loadingMarkup = renderToStaticMarkup(
      <ContentState
        description="Please wait."
        title="Loading"
        tone="loading"
      />,
    );

    expect(errorMarkup).toContain('role="alert"');
    expect(loadingMarkup).toContain('role="status"');
    expect(loadingMarkup).toContain('aria-live="polite"');
  });

  it("renders a dropzone with camera and multi-file pickers", async () => {
    const markup = renderToStaticMarkup(
      <UploadTrayProvider>
        {await UploadPage({ searchParams: Promise.resolve({}) })}
      </UploadTrayProvider>,
    );

    expect(markup).toContain("גררו קבצים לכאן");
    expect(markup).toContain(
      'accept="image/jpeg,image/png,image/webp,application/pdf"',
    );
    expect(markup).toContain("בחירת קבצים");
    expect(markup).toContain("צילום");
  });

  it("hands what a share ingested to the upload tray, refusals included", async () => {
    const page = await UploadPage({
      searchParams: Promise.resolve({
        shared: [
          "uploaded|de305d54-75b4-431b-adb2-eb6b9e546013||receipt.pdf",
          "rejected||Not accepted.|notes.txt",
        ],
      }),
    });
    const adopter = Children.toArray(page.props.children).find(
      (child): child is ReactElement<{ results: unknown }> =>
        isValidElement(child) && child.type === SharedUploads,
    );

    expect(adopter?.props.results).toEqual([
      {
        documentId: "de305d54-75b4-431b-adb2-eb6b9e546013",
        fileName: "receipt.pdf",
        status: "uploaded",
      },
      { fileName: "notes.txt", message: "Not accepted.", status: "rejected" },
    ]);
    // The tray owns every outcome now, so the page keeps no notice of its own.
    expect(
      renderToStaticMarkup(<UploadTrayProvider>{page}</UploadTrayProvider>),
    ).not.toContain('role="alert"');
  });

  it("tells apart a share that carried nothing from one it could not read", async () => {
    const render = async (share: string) =>
      renderToStaticMarkup(
        <UploadTrayProvider>
          {await UploadPage({ searchParams: Promise.resolve({ share }) })}
        </UploadTrayProvider>,
      );

    expect(await render("empty")).toContain("לא שותפו קבצים");
    expect(await render("unreadable")).toContain("לא ניתן היה לקרוא את השיתוף");
  });
});

describe("logout action", () => {
  it("destroys the authenticated session before redirecting to login", async () => {
    await logoutAction();

    expect(authMocks.logout).toHaveBeenCalledOnce();
    expect(navigationMocks.redirect).toHaveBeenCalledWith("/login");
  });
});
