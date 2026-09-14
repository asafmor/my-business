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
  list: vi.fn().mockResolvedValue({ page: 1, pageSize: 25, rows: [], total: 0 }),
  listActiveCategories: vi.fn().mockResolvedValue([]),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: navigationMocks.redirect,
  usePathname: () => "/documents",
}));
vi.mock("../src/server/auth/service", () => authMocks);
vi.mock("../src/server/documents/processing-dispatcher", () => dispatcherMocks);
vi.mock("../src/server/documents/documents-query-repository", () => ({
  DrizzleDocumentsQueryRepository: function DrizzleDocumentsQueryRepository() {
    return documentsQueryMocks;
  },
}));

import { logoutAction } from "../src/app/(protected)/actions";
import DashboardPage from "../src/app/(protected)/page";
import CategoriesPage from "../src/app/(protected)/categories/page";
import DocumentsPage from "../src/app/(protected)/documents/page";
import InboxPage from "../src/app/(protected)/inbox/page";
import ProtectedLayout from "../src/app/(protected)/layout";
import ReportsPage from "../src/app/(protected)/reports/page";
import SettingsPage from "../src/app/(protected)/settings/page";
import UploadPage from "../src/app/(protected)/upload/page";
import {
  ApplicationNavigation,
  getNextDrawerFocusIndex,
  MobileNavigationDrawer,
} from "../src/components/layout/app-shell";
import { ContentState } from "../src/components/ui/content-state";

describe("protected application shell", () => {
  it("enforces a shared server session in the layout and every shell route", async () => {
    const pages = [
      DashboardPage,
      InboxPage,
      ReportsPage,
      CategoriesPage,
      SettingsPage,
      UploadPage,
    ];

    renderToStaticMarkup(await ProtectedLayout({ children: <p>Content</p> }));
    await Promise.all(pages.map((Page) => Page()));
    await DocumentsPage({ searchParams: Promise.resolve({}) });

    expect(authMocks.requireSession).toHaveBeenCalledTimes(8);
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
    expect(markup).toContain(">Upload<");
    expect(markup).toContain(">Log out<");
  });
});

describe("application navigation", () => {
  it("marks exactly the matching navigation route as current", () => {
    const markup = renderToStaticMarkup(
      <ApplicationNavigation pathname="/documents/123" />,
    );

    expect(markup).toMatch(
      /aria-current="page" class="app-navigation__link is-current" href="\/documents"/,
    );
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toContain('href="/settings"');
  });

  it("provides a labelled modal drawer and wraps keyboard focus", () => {
    const markup = renderToStaticMarkup(
      <MobileNavigationDrawer
        closeButtonRef={{ current: null }}
        drawerRef={{ current: null }}
        isOpen
        onClose={() => undefined}
        pathname="/inbox"
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-label="Close navigation"');
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

  it("renders a multi-file upload queue with camera and duplicate affordances", async () => {
    const markup = renderToStaticMarkup(await UploadPage());

    expect(markup).toContain("Upload documents");
    expect(markup).toContain(
      'accept="image/jpeg,image/png,image/webp,application/pdf"',
    );
    expect(markup).toContain("Choose files");
    expect(markup).toContain("Take photo");
  });
});

describe("logout action", () => {
  it("destroys the authenticated session before redirecting to login", async () => {
    await logoutAction();

    expect(authMocks.logout).toHaveBeenCalledOnce();
    expect(navigationMocks.redirect).toHaveBeenCalledWith("/login");
  });
});
