"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { logoutAction } from "../../app/(protected)/actions";

type IconName =
  | "categories"
  | "dashboard"
  | "documents"
  | "inbox"
  | "menu"
  | "reports"
  | "settings"
  | "upload"
  | "x";

type NavigationItem = {
  href: string;
  icon: IconName;
  label: string;
};

type NavigationSection = {
  items: readonly NavigationItem[];
  label: string;
};

export const navigationSections: readonly NavigationSection[] = [
  {
    label: "Workspace",
    items: [
      { href: "/", icon: "dashboard", label: "Dashboard" },
      { href: "/inbox", icon: "inbox", label: "Inbox" },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/documents", icon: "documents", label: "Documents" },
      { href: "/categories", icon: "categories", label: "Categories" },
    ],
  },
  {
    label: "Insight",
    items: [
      { href: "/reports", icon: "reports", label: "Reports" },
      { href: "/settings", icon: "settings", label: "Settings" },
    ],
  },
];

export const navigationItems: readonly NavigationItem[] =
  navigationSections.flatMap((section) => section.items);

function isCurrentRoute(href: string, pathname: string): boolean {
  return href === "/"
    ? pathname === href
    : pathname.startsWith(`${href}/`) || pathname === href;
}

function AppIcon({ name }: { name: IconName }) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    height: 20,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    width: 20,
  };

  const paths: Record<IconName, ReactNode> = {
    categories: (
      <path d="m4 7 6-4 10 6v8l-6 4-10-6V7Zm6-4v8l10 6M4 7l10 6 6-4" />
    ),
    dashboard: (
      <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />
    ),
    documents: (
      <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 0v5h5M9 13h6m-6 4h6" />
    ),
    inbox: <path d="M4 5h16v14H4V5Zm0 9h4l2 3h4l2-3h4" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    reports: <path d="M5 20V10m7 10V4m7 16v-7" />,
    settings: (
      <path
        d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5ZM19 13.5v-3l-2.3-.7a7 7 0 0 0-.65-1.55l1.1-2.15-2.1-2.1-2.15 1.1a7 7 0 0 0-1.55-.65L10.5 2h-3l-.7 2.3a7 7 0 0 0-1.55.65L3.1 3.85 1 5.95l1.1 2.15a7 7 0 0 0-.65 1.55L-.85 10.5v3l2.3.7a7 7 0 0 0 .65 1.55L1 17.9 3.1 20l2.15-1.1a7 7 0 0 0 1.55.65l.7 2.3h3l.7-2.3a7 7 0 0 0 1.55-.65L14.9 20l2.1-2.1-1.1-2.15a7 7 0 0 0 .65-1.55l2.3-.7Z"
        transform="translate(2 0) scale(.83)"
      />
    ),
    upload: <path d="M12 16V4m0 0L8 8m4-4 4 4M5 14v5h14v-5" />,
    x: <path d="m6 6 12 12M18 6 6 18" />,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function BrandMark() {
  return (
    <svg aria-hidden="true" className="brand-mark" viewBox="0 0 28 28">
      <path d="M5 22V11l9-6 9 6v11H5Z" fill="currentColor" opacity="0.16" />
      <path
        d="M5 22V11l9-6 9 6v11M10 22v-6h8v6M5 11l9 6 9-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function ApplicationNavigation({
  onNavigate,
  pathname,
}: {
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <nav aria-label="Primary navigation" className="app-navigation">
      {navigationSections.map((section) => (
        <div className="app-navigation__section" key={section.label}>
          <p className="app-navigation__section-label">{section.label}</p>
          <ul>
            {section.items.map((item) => {
              const current = isCurrentRoute(item.href, pathname);

              return (
                <li key={item.href}>
                  <Link
                    aria-current={current ? "page" : undefined}
                    className={
                      current
                        ? "app-navigation__link is-current"
                        : "app-navigation__link"
                    }
                    href={item.href}
                    onClick={onNavigate}
                  >
                    <AppIcon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
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
          <h2 id="mobile-navigation-title">Navigation</h2>
          <button
            aria-label="Close navigation"
            className="icon-button"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <AppIcon name="x" />
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
      <button className="text-button" type="submit">
        Log out
      </button>
    </form>
  );
}

function AccountCard() {
  return (
    <div className="account-card">
      <span aria-hidden="true" className="account-card__avatar">
        MB
      </span>
      <span className="account-card__identity">
        <span className="account-card__name">My Business</span>
        <span className="account-card__role">Owner · private workspace</span>
      </span>
      <LogoutForm />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const navigationButtonRef = useRef<HTMLButtonElement>(null);
  const didOpenDrawer = useRef(false);

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
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-header">
        <div className="app-header__identity">
          <button
            aria-controls="mobile-navigation"
            aria-expanded={isDrawerOpen}
            aria-label="Open navigation"
            className="icon-button app-header__menu-button"
            onClick={() => setIsDrawerOpen(true)}
            ref={navigationButtonRef}
            type="button"
          >
            <AppIcon name="menu" />
          </button>
          <Link
            aria-label="My Business dashboard"
            className="app-brand"
            href="/"
          >
            <BrandMark />
            <span>My Business</span>
          </Link>
        </div>
        <div className="app-header__tools">
          <label className="global-search">
            <span className="sr-only">Global search</span>
            <input
              aria-label="Global search, coming soon"
              disabled
              placeholder="Search documents"
              type="search"
            />
          </label>
          <Link className="button button--primary" href="/upload">
            <AppIcon name="upload" />
            <span>Upload</span>
          </Link>
        </div>
      </header>
      <div className="app-frame">
        <aside className="app-sidebar" aria-label="Application navigation">
          <ApplicationNavigation pathname={pathname} />
          <AccountCard />
        </aside>
        <main className="app-main" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
      <MobileNavigationDrawer
        closeButtonRef={closeButtonRef}
        drawerRef={drawerRef}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        pathname={pathname}
      />
    </div>
  );
}
