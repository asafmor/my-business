"use client";

import {
  ChartColumn,
  FileText,
  House,
  Inbox,
  LayoutGrid,
  LogOut,
  Menu,
  PanelRight,
  Search,
  Settings,
  Tags,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { logoutAction } from "../../app/(protected)/actions";
import { appName, countOf } from "../../lib/labels";
import { NavigationProgress } from "./navigation-progress";
import { UploadTray } from "../uploads/upload-tray";
import {
  UploadTrayProvider,
  useUploadTray,
} from "../uploads/upload-tray-provider";

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

/* One flat rail, no section labels: four destinations do not need chapters. */
export const navigationItems: readonly NavigationItem[] = [
  { href: "/", icon: LayoutGrid, label: "לוח בקרה" },
  { href: "/documents", icon: FileText, label: "מסמכים" },
  { href: "/categories", icon: Tags, label: "קטגוריות" },
  { href: "/reports", icon: ChartColumn, label: "דוחות" },
];

/* Settings lives at the foot of the rail, above the account card. */
const settingsItem: NavigationItem = {
  href: "/settings",
  icon: Settings,
  label: "הגדרות",
};

/*
 * The header is the page title, the way the artboards draw it — so pages no
 * longer carry their own heading block. Keyed by route; the longest matching
 * prefix wins, which leaves document detail with the generic "Document".
 */
const pageTitles: Record<string, string> = {
  "/": "לוח בקרה",
  "/categories": "קטגוריות",
  "/documents": "מסמכים",
  "/documents/": "מסמך",
  "/reports": "דוחות",
  "/settings": "הגדרות",
  "/upload": "העלאת מסמכים",
};

export function pageHeaderFor(pathname: string): { title: string } {
  const match = Object.keys(pageTitles)
    .filter((route) => route === "/" || pathname.startsWith(route))
    .sort((a, b) => b.length - a.length)
    .find((route) => route !== "/" || pathname === "/");

  return { title: match ? pageTitles[match]! : appName };
}

const railStorageKey = "my-business:rail-collapsed";

function isCurrentRoute(href: string, pathname: string): boolean {
  return href === "/"
    ? pathname === href
    : pathname.startsWith(`${href}/`) || pathname === href;
}

export function ApplicationNavigation({
  onNavigate,
  pathname,
}: {
  onNavigate?: () => void;
  pathname: string;
}) {
  const link = (item: NavigationItem) => {
    const current = isCurrentRoute(item.href, pathname);
    const Icon = item.icon;

    return (
      <li key={item.href}>
        <Link
          aria-current={current ? "page" : undefined}
          className={
            current ? "app-navigation__link is-current" : "app-navigation__link"
          }
          href={item.href}
          onClick={onNavigate}
          title={item.label}
        >
          <Icon aria-hidden size={16} strokeWidth={1.7} />
          <span>{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="ניווט ראשי" className="app-navigation">
      <ul>{navigationItems.map(link)}</ul>
      <ul className="app-navigation__foot">{link(settingsItem)}</ul>
    </nav>
  );
}

export function getNextDrawerFocusIndex(
  activeIndex: number,
  focusableCount: number,
  shiftKey: boolean,
): number {
  if (focusableCount === 0) {
    return -1;
  }

  if (activeIndex === -1) {
    return shiftKey ? focusableCount - 1 : 0;
  }

  if (shiftKey && activeIndex === 0) {
    return focusableCount - 1;
  }

  if (!shiftKey && activeIndex === focusableCount - 1) {
    return 0;
  }

  return activeIndex;
}

export function MobileNavigationDrawer({
  isOpen,
  onClose,
  pathname,
  drawerRef,
  closeButtonRef,
}: {
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  drawerRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="mobile-drawer-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <aside
        aria-labelledby="mobile-navigation-title"
        aria-modal="true"
        className="mobile-drawer"
        id="mobile-navigation"
        ref={drawerRef}
        role="dialog"
      >
        <div className="mobile-drawer__header">
          <h2 id="mobile-navigation-title">ניווט</h2>
          <button
            aria-label="סגירת הניווט"
            className="icon-button"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden size={20} strokeWidth={1.8} />
          </button>
        </div>
        <ApplicationNavigation onNavigate={onClose} pathname={pathname} />
        <AccountCard />
      </aside>
    </div>
  );
}

function LogoutForm() {
  return (
    <form action={logoutAction}>
      <button
        aria-label="התנתקות"
        className="icon-button"
        title="התנתקות"
        type="submit"
      >
        <LogOut aria-hidden size={14} strokeWidth={1.8} />
      </button>
    </form>
  );
}

const tabBarItems: readonly NavigationItem[] = [
  { href: "/", icon: LayoutGrid, label: "בית" },
  { href: "/documents", icon: FileText, label: "מסמכים" },
  { href: "/reports", icon: ChartColumn, label: "דוחות" },
  { href: "/settings", icon: Settings, label: "הגדרות" },
];

/*
 * Mobile's primary navigation. Thumb-reachable, four destinations and the
 * capture action; everything else stays behind the drawer.
 */
function MobileTabBar({ pathname }: { pathname: string }) {
  const { minimize } = useUploadTray();
  const [first, second] = [tabBarItems.slice(0, 2), tabBarItems.slice(2)];

  const tab = (item: NavigationItem) => {
    const current = isCurrentRoute(item.href, pathname);
    const Icon = item.icon;

    return (
      <li key={item.href}>
        <Link
          aria-current={current ? "page" : undefined}
          className={current ? "tab-bar__link is-current" : "tab-bar__link"}
          href={item.href}
          onClick={minimize}
        >
          <Icon aria-hidden size={20} strokeWidth={1.8} />
          <span>{item.label}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="ניווט מהיר" className="tab-bar">
      <ul>
        {first.map(tab)}
        <li className="tab-bar__capture">
          <Link aria-label="העלאת מסמך" href="/upload" onClick={minimize}>
            <Upload aria-hidden size={22} strokeWidth={2} />
          </Link>
        </li>
        {second.map(tab)}
      </ul>
    </nav>
  );
}

/* The workspace identity, at the head of the rail — never in the top bar. */
function WorkspaceMark({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="workspace-mark">
      <span aria-hidden="true" className="workspace-mark__glyph">
        <House size={15} strokeWidth={1.9} />
      </span>
      <span className="workspace-mark__identity">
        <span className="workspace-mark__name">{appName}</span>
        <span className="workspace-mark__note">סביבת עבודה פרטית</span>
      </span>
      <button
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? "הרחבת סרגל הצד" : "כיווץ סרגל הצד"}
        className="workspace-mark__collapse"
        onClick={onToggle}
        title={isCollapsed ? "הרחבת סרגל הצד" : "כיווץ סרגל הצד"}
        type="button"
      >
        <PanelRight aria-hidden size={18} strokeWidth={1.7} />
      </button>
    </div>
  );
}

function SidebarSearch() {
  return (
    <label className="global-search" title="חיפוש בכל המערכת">
      <span className="sr-only">חיפוש כללי</span>
      <Search aria-hidden size={13} strokeWidth={1.9} />
      <input
        aria-label="חיפוש כללי, בקרוב"
        disabled
        placeholder="חיפוש בכל המערכת"
        type="search"
      />
    </label>
  );
}

function AccountCard() {
  return (
    <div className="account-card">
      <span aria-hidden="true" className="account-card__avatar">
        ע
      </span>
      <span className="account-card__identity">
        <span className="account-card__name">{appName}</span>
        <span className="account-card__role">בעלים</span>
      </span>
      <LogoutForm />
    </div>
  );
}

function UploadTrayToggleButton() {
  const { counts, toggleOpen, view } = useUploadTray();

  return (
    <button
      aria-expanded={view !== "dismissed"}
      aria-label={
        counts.all > 0
          ? `מגש העלאות, ${countOf(counts.all, "פריט אחד", "פריטים")}`
          : "מגש העלאות"
      }
      className="icon-button upload-tray-toggle"
      onClick={toggleOpen}
      type="button"
    >
      <Inbox aria-hidden size={17} strokeWidth={1.7} />
      {counts.all > 0 ? (
        <span aria-hidden="true" className="upload-tray-toggle__badge">
          {counts.all > 99 ? "99+" : counts.all}
        </span>
      ) : null}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const header = pageHeaderFor(pathname);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const navigationButtonRef = useRef<HTMLButtonElement>(null);
  const didOpenDrawer = useRef(false);

  /* Read after mount so the server and first client render agree. */
  useEffect(() => {
    setIsRailCollapsed(localStorage.getItem(railStorageKey) === "1");
  }, []);

  useEffect(() => {
    if (!isDrawerOpen) {
      if (didOpenDrawer.current) {
        navigationButtonRef.current?.focus();
        didOpenDrawer.current = false;
      }
      return;
    }

    didOpenDrawer.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsDrawerOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const activeIndex = focusableElements.indexOf(
        document.activeElement as HTMLElement,
      );
      const nextIndex = getNextDrawerFocusIndex(
        activeIndex,
        focusableElements.length,
        event.shiftKey,
      );

      if (nextIndex !== activeIndex && nextIndex !== -1) {
        event.preventDefault();
        focusableElements[nextIndex]?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen]);

  return (
    <UploadTrayProvider>
      <div className="app-shell">
        <a className="skip-link" href="#main-content">
          דילוג לתוכן הראשי
        </a>
        <div
          className="app-frame"
          data-rail={isRailCollapsed ? "collapsed" : undefined}
        >
          <aside className="app-sidebar" aria-label="ניווט היישום">
            <div className="app-sidebar__head">
              <WorkspaceMark
                isCollapsed={isRailCollapsed}
                onToggle={() =>
                  setIsRailCollapsed((collapsed) => {
                    localStorage.setItem(railStorageKey, collapsed ? "0" : "1");
                    return !collapsed;
                  })
                }
              />
              <SidebarSearch />
            </div>
            <ApplicationNavigation pathname={pathname} />
            <AccountCard />
          </aside>
          <div className="app-workspace">
            <header className="app-header">
              <button
                aria-controls="mobile-navigation"
                aria-expanded={isDrawerOpen}
                aria-label="פתיחת הניווט"
                className="icon-button app-header__menu-button"
                onClick={() => setIsDrawerOpen(true)}
                ref={navigationButtonRef}
                type="button"
              >
                <Menu aria-hidden size={20} strokeWidth={1.8} />
              </button>
              <h1 className="app-header__title">{header.title}</h1>
              <div className="app-header__tools">
                <UploadTrayToggleButton />
                <Link className="button button--primary" href="/upload">
                  <Upload aria-hidden size={14} strokeWidth={2} />
                  <span>העלאה</span>
                </Link>
              </div>
            </header>
            {/* Suspense: useSearchParams inside must not opt a route out of
                static rendering just to report that it is loading. */}
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>
            <main className="app-main" id="main-content" tabIndex={-1}>
              {children}
            </main>
          </div>
        </div>
        <MobileTabBar pathname={pathname} />
        <MobileNavigationDrawer
          closeButtonRef={closeButtonRef}
          drawerRef={drawerRef}
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          pathname={pathname}
        />
        <UploadTray />
      </div>
    </UploadTrayProvider>
  );
}
