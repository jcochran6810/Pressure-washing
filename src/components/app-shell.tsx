"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type NavLeaf = { href: string; label: string; icon: string };
type NavGroup = { key: string; label: string; icon: string; children: NavLeaf[] };

const DASHBOARD: NavLeaf = { href: "/dashboard", label: "Dashboard", icon: "▦" };

const GROUPS: NavGroup[] = [
  {
    key: "billing",
    label: "Estimates / Invoices",
    icon: "✎",
    children: [
      { href: "/estimates", label: "Estimates", icon: "✎" },
      { href: "/invoices", label: "Invoices", icon: "$" },
      { href: "/payments", label: "Receipts", icon: "✓" },
      { href: "/measure", label: "Measure", icon: "▭" },
      { href: "/waivers", label: "Waivers", icon: "✍" },
    ],
  },
  {
    key: "people",
    label: "Customers / Contracts / Properties",
    icon: "♟",
    children: [
      { href: "/customers", label: "Customers", icon: "♟" },
      { href: "/contracts", label: "Contracts", icon: "↻" },
      { href: "/properties", label: "Properties", icon: "⌂" },
    ],
  },
  {
    key: "jobs",
    label: "Jobs",
    icon: "⚒",
    children: [
      { href: "/jobs", label: "Jobs", icon: "⚒" },
      { href: "/calendar", label: "Calendar", icon: "▤" },
    ],
  },
  {
    key: "pricing",
    label: "Service pricing",
    icon: "⚐",
    children: [{ href: "/services", label: "Services", icon: "⚐" }],
  },
  {
    key: "supplies",
    label: "Chemicals / Equipment",
    icon: "⚗",
    children: [
      { href: "/chemicals", label: "Chemicals", icon: "⚗" },
      { href: "/mix", label: "Mix calculator", icon: "≋" },
      { href: "/equipment", label: "Equipment", icon: "⚙" },
    ],
  },
  {
    key: "growth",
    label: "Marketing / Accounting / Leads",
    icon: "📣",
    children: [
      { href: "/campaigns", label: "Marketing", icon: "📣" },
      { href: "/accounting", label: "Accounting sync", icon: "⇄" },
      { href: "/leads", label: "Leads", icon: "★" },
      { href: "/expenses", label: "Expenses", icon: "−" },
      { href: "/reports", label: "Reports", icon: "📊" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    icon: "⚙",
    children: [{ href: "/settings", label: "Settings", icon: "⚙" }],
  },
];

const MOBILE_TABS: NavLeaf[] = [
  { href: "/dashboard", label: "Home", icon: "▦" },
  { href: "/estimates", label: "Estimates", icon: "✎" },
  { href: "/jobs", label: "Jobs", icon: "⚒" },
  { href: "/customers", label: "Customers", icon: "♟" },
  { href: "/invoices", label: "Invoices", icon: "$" },
];

export function AppShell({
  children,
  orgName,
  userEmail,
  isDemo,
  badges,
}: {
  children: React.ReactNode;
  orgName: string;
  userEmail: string;
  isDemo?: boolean;
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const activeGroupKey = useMemo(() => {
    for (const g of GROUPS) {
      if (g.children.some((c) => isActive(c.href))) return g.key;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(activeGroupKey ? [activeGroupKey] : []),
  );

  useEffect(() => {
    if (activeGroupKey) {
      setOpenGroups((prev) => {
        if (prev.has(activeGroupKey)) return prev;
        const next = new Set(prev);
        next.add(activeGroupKey);
        return next;
      });
    }
  }, [activeGroupKey]);

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const badgeFor = (href: string) => badges?.[href] ?? 0;
  const groupBadgeCount = (g: NavGroup) => g.children.reduce((s, c) => s + badgeFor(c.href), 0);

  function renderNav(onLeafClick?: () => void) {
    return (
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <Link
          href={DASHBOARD.href}
          onClick={onLeafClick}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium",
            isActive(DASHBOARD.href) ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-100",
          )}
        >
          <span className="w-5 text-center text-gray-400">{DASHBOARD.icon}</span>
          <span className="flex-1">{DASHBOARD.label}</span>
        </Link>

        {GROUPS.map((g) => {
          const open = openGroups.has(g.key);
          const groupActive = activeGroupKey === g.key;
          const count = groupBadgeCount(g);
          return (
            <div key={g.key}>
              <button
                type="button"
                onClick={() => toggleGroup(g.key)}
                aria-expanded={open}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-left",
                  groupActive && !isActive(DASHBOARD.href)
                    ? "text-brand-700"
                    : "text-gray-700 hover:bg-gray-100",
                )}
              >
                <span className="w-5 text-center text-gray-400">{g.icon}</span>
                <span className="flex-1 truncate">{g.label}</span>
                {count > 0 && <NavBadge count={count} />}
                <span
                  className={cn(
                    "text-gray-400 text-xs transition-transform",
                    open ? "rotate-90" : "rotate-0",
                  )}
                  aria-hidden
                >
                  ▶
                </span>
              </button>
              {open && (
                <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-gray-200 space-y-0.5">
                  {g.children.map((c) => {
                    const childCount = badgeFor(c.href);
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        onClick={onLeafClick}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm",
                          isActive(c.href)
                            ? "bg-brand-50 text-brand-700 font-medium"
                            : "text-gray-600 hover:bg-gray-100",
                        )}
                      >
                        <span className="w-4 text-center text-gray-400 text-xs">{c.icon}</span>
                        <span className="flex-1">{c.label}</span>
                        {childCount > 0 && <NavBadge count={childCount} />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        <div className="px-4 py-5 flex items-center gap-2 font-bold text-lg border-b">
          <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">S</span>
          <span className="truncate">{orgName}</span>
        </div>
        {renderNav()}
        <div className="p-3 border-t text-xs text-gray-500">
          <div className="truncate mb-2">{userEmail}</div>
          <form action="/auth/signout" method="post">
            <button className="btn-secondary w-full text-xs py-1.5">Sign out</button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold">
          <span className="inline-block w-7 h-7 rounded-lg bg-brand-600 text-white grid place-items-center text-sm">S</span>
          <span className="truncate max-w-[180px]">{orgName}</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -mr-2 text-gray-600"
          aria-label="Open menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-80 max-w-[85vw] bg-white shadow-xl flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <span className="font-bold">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="p-2 -mr-2" aria-label="Close menu">✕</button>
            </div>
            {renderNav(() => setMobileOpen(false))}
            <div className="p-3 border-t text-xs text-gray-500">
              <div className="truncate mb-2">{userEmail}</div>
              <form action="/auth/signout" method="post">
                <button className="btn-secondary w-full text-xs py-1.5">Sign out</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 lg:ml-64 pb-20 lg:pb-0">
        {isDemo && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2 text-xs text-amber-800 flex items-center justify-between gap-3">
            <span>
              <strong>Demo mode</strong> — sample data only. Sign up to keep your work.
            </span>
            <Link href="/signup" className="text-amber-900 underline font-medium">Create real account</Link>
          </div>
        )}
        <div className="px-4 sm:px-6 py-5 sm:py-6 max-w-7xl mx-auto">{children}</div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 grid grid-cols-5">
        {MOBILE_TABS.map((item) => {
          const count = badgeFor(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center py-2 text-xs font-medium",
                isActive(item.href) ? "text-brand-600" : "text-gray-500",
              )}
            >
              <span className="relative text-lg leading-none">
                {item.icon}
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-[18px] text-center">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function NavBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}
