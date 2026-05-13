"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type NavLeaf = { href: string; label: string };
type NavGroup = {
  key: string;
  n: number;
  label: string;
  icon: ReactNode;
  children: NavLeaf[];
};

const GROUPS: NavGroup[] = [
  {
    key: "dashboard",
    n: 1,
    label: "Dashboard",
    icon: <DashboardIcon />,
    children: [
      { href: "/dashboard#overview", label: "Overview" },
      { href: "/dashboard#kpis", label: "KPIs" },
      { href: "/dashboard#alerts", label: "Alerts" },
      { href: "/dashboard#this-week", label: "This Week's Jobs" },
      { href: "/dashboard#alerts", label: "Quick Actions" },
    ],
  },
  {
    key: "customers",
    n: 2,
    label: "Customers",
    icon: <UsersIcon />,
    children: [
      { href: "/customers", label: "Customer List" },
      { href: "/properties", label: "Properties" },
      { href: "/contracts", label: "Contracts" },
      { href: "/waivers", label: "Waivers" },
    ],
  },
  {
    key: "estimates_jobs",
    n: 3,
    label: "Estimates & Jobs",
    icon: <ClipboardIcon />,
    children: [
      { href: "/estimates/new", label: "New Estimate" },
      { href: "/estimates", label: "Estimate Pipeline" },
      { href: "/calendar", label: "Job Calendar" },
      { href: "/jobs", label: "Job Status" },
    ],
  },
  {
    key: "invoices_payments",
    n: 4,
    label: "Invoices & Payments",
    icon: <DollarIcon />,
    children: [
      { href: "/invoices/new", label: "New Invoice" },
      { href: "/invoices", label: "Invoices" },
      { href: "/invoices?status=sent", label: "Outstanding Balances" },
      { href: "/payments", label: "Receipts" },
    ],
  },
  {
    key: "operations",
    n: 5,
    label: "Operations",
    icon: <SlidersIcon />,
    children: [
      { href: "/services", label: "Services & Pricing" },
      { href: "/measure", label: "Satellite Measurements" },
      { href: "/chemicals", label: "Chemicals" },
      { href: "/mix", label: "Mix Calculator" },
      { href: "/equipment", label: "Equipment" },
    ],
  },
  {
    key: "marketing_reports",
    n: 6,
    label: "Marketing & Reports",
    icon: <BarChartIcon />,
    children: [
      { href: "/leads", label: "Leads" },
      { href: "/campaigns", label: "Campaigns" },
      { href: "/reports", label: "Reports Dashboard" },
      { href: "/accounting", label: "Profit & Loss" },
      { href: "/expenses", label: "Expenses" },
    ],
  },
];

const QUICK_ADD = [
  { href: "/estimates/new", label: "New Estimate" },
  { href: "/invoices/new", label: "New Invoice" },
  { href: "/jobs/new", label: "New Job" },
  { href: "/customers/new", label: "New Customer" },
  { href: "/leads/new", label: "New Lead" },
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
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const isActive = (href: string) => {
    const path = href.split("#")[0].split("?")[0];
    if (!path) return false;
    return pathname === path || pathname.startsWith(path + "/");
  };

  const activeGroupKey = useMemo(() => {
    for (const g of GROUPS) {
      if (g.children.some((c) => isActive(c.href))) return g.key;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(activeGroupKey ? [activeGroupKey] : ["dashboard"]),
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

  const badgeFor = (href: string) => badges?.[href.split("#")[0].split("?")[0]] ?? 0;
  const groupBadgeCount = (g: NavGroup) => g.children.reduce((s, c) => s + badgeFor(c.href), 0);

  function renderNav(onLeafClick?: () => void) {
    return (
      <nav className="flex-1 overflow-y-auto p-3 space-y-2">
        {GROUPS.map((g) => {
          const open = openGroups.has(g.key);
          const groupActive = activeGroupKey === g.key;
          const count = groupBadgeCount(g);
          return (
            <div
              key={g.key}
              className={cn(
                "bg-white rounded-xl border overflow-hidden transition-shadow",
                groupActive ? "border-brand-200 shadow-sm" : "border-gray-200",
              )}
            >
              <button
                type="button"
                onClick={() => toggleGroup(g.key)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-50"
              >
                <NavIconTile n={g.n} active={groupActive}>
                  {g.icon}
                </NavIconTile>
                <span className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "block font-semibold truncate",
                      groupActive ? "text-brand-700" : "text-gray-900",
                    )}
                  >
                    {g.label}
                  </span>
                </span>
                {count > 0 && <NavBadge count={count} />}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={cn(
                    "text-gray-400 transition-transform",
                    open ? "rotate-180" : "rotate-0",
                  )}
                  aria-hidden
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {open && (
                <ul className="px-3 pb-3 pt-1 space-y-0.5 border-t border-gray-100">
                  {g.children.map((c, idx) => {
                    const path = c.href.split("#")[0].split("?")[0];
                    const active = pathname === path;
                    const childCount = badgeFor(c.href);
                    return (
                      <li key={`${c.label}-${idx}`}>
                        <Link
                          href={c.href}
                          onClick={onLeafClick}
                          className={cn(
                            "flex items-center gap-2.5 pl-2 pr-2 py-1.5 rounded-md text-sm",
                            active
                              ? "bg-brand-50 text-brand-700 font-medium"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full flex-shrink-0",
                              active ? "bg-brand-600" : "bg-gray-300",
                            )}
                          />
                          <span className="flex-1">{c.label}</span>
                          {childCount > 0 && <NavBadge count={childCount} />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-gray-50 border-r border-gray-200">
        <div className="px-4 py-5 flex items-center gap-2 font-bold text-lg border-b bg-white">
          <span className="inline-block w-9 h-9 rounded-xl bg-brand-600 text-white grid place-items-center">S</span>
          <span className="truncate">{orgName}</span>
        </div>
        {renderNav()}
        <div className="p-3 border-t bg-white text-xs text-gray-500 space-y-2">
          <Link href="/settings" className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 text-gray-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
            <span>Settings</span>
          </Link>
          <div className="truncate px-2">{userEmail}</div>
          <form action="/auth/signout" method="post">
            <button className="btn-secondary w-full text-xs py-1.5">Sign out</button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 -ml-1.5 text-gray-600"
          aria-label="Open menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="flex items-center gap-2 font-bold">
          <span className="inline-block w-7 h-7 rounded-lg bg-brand-600 text-white grid place-items-center text-sm">S</span>
          <span className="truncate max-w-[160px]">{orgName}</span>
        </div>
        <Link
          href="/settings"
          aria-label="Settings"
          className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm font-semibold"
        >
          {(userEmail[0] || "?").toUpperCase()}
        </Link>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[90vw] max-w-sm bg-gray-50 shadow-xl flex flex-col">
            <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">S</span>
                <span className="truncate max-w-[180px]">{orgName}</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-2 -mr-2" aria-label="Close menu">✕</button>
            </div>
            {renderNav(() => setMobileOpen(false))}
            <div className="p-3 border-t bg-white text-xs text-gray-500 space-y-2">
              <Link
                href="/settings"
                onClick={() => setMobileOpen(false)}
                className="block px-2 py-1.5 rounded-md hover:bg-gray-100 text-gray-700"
              >
                Settings
              </Link>
              <div className="truncate px-2">{userEmail}</div>
              <form action="/auth/signout" method="post">
                <button className="btn-secondary w-full text-xs py-1.5">Sign out</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 lg:ml-72 pb-24 lg:pb-0">
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
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200">
        <div className="grid grid-cols-4 relative">
          <BottomTab href="/dashboard" label="Home" active={isActive("/dashboard")} icon={<HomeIcon />} />
          <BottomTab href="/jobs" label="Jobs" active={isActive("/jobs")} icon={<BriefcaseIcon />} />
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            aria-label="Quick add"
            className="absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 rounded-full bg-brand-600 text-white shadow-lg grid place-items-center active:scale-95 transition-transform"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <div aria-hidden />
          <BottomTab href="/calendar" label="Calendar" active={isActive("/calendar")} icon={<CalendarIcon />} />
        </div>
      </nav>

      {/* Quick-add bottom sheet */}
      {addOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl pt-2 pb-6 px-4 shadow-xl">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider px-2 mb-2">
              Quick add
            </h3>
            <ul className="divide-y divide-gray-100">
              {QUICK_ADD.map((item) => (
                <li key={item.href}>
                  <button
                    type="button"
                    className="w-full text-left py-3 px-2 text-base font-medium text-gray-800 hover:bg-gray-50 rounded-md"
                    onClick={() => {
                      setAddOpen(false);
                      router.push(item.href);
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="mt-3 w-full btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavIconTile({ n, active, children }: { n: number; active: boolean; children: ReactNode }) {
  return (
    <span className="relative shrink-0">
      <span
        className={cn(
          "w-10 h-10 rounded-lg grid place-items-center",
          active ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600",
        )}
      >
        {children}
      </span>
      <span
        className={cn(
          "absolute -top-1.5 -left-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-[18px] text-center",
          active ? "bg-white text-brand-700 ring-1 ring-brand-600" : "bg-brand-600 text-white",
        )}
      >
        {n}
      </span>
    </span>
  );
}

function NavBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function BottomTab({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center py-2 text-[11px] font-medium",
        active ? "text-brand-600" : "text-gray-500",
      )}
    >
      <span className="w-6 h-6 mb-0.5 grid place-items-center">{icon}</span>
      {label}
    </Link>
  );
}

/* ----- Icons ----- */

function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
