"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NotificationsBell, type Notification } from "@/components/notifications";

type NavItem = { href: string; label: string; icon: string };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/customers", label: "Customers", icon: "♟" },
  { href: "/properties", label: "Properties", icon: "⌂" },
  { href: "/contracts", label: "Contracts", icon: "↻" },
  { href: "/measure", label: "Measure", icon: "▭" },
  { href: "/estimates", label: "Estimates", icon: "✎" },
  { href: "/jobs", label: "Jobs", icon: "⚒" },
  { href: "/recurring", label: "Recurring jobs", icon: "↻" },
  { href: "/follow-ups", label: "Follow-ups", icon: "✓" },
  { href: "/calendar", label: "Calendar", icon: "▤" },
  { href: "/invoices", label: "Invoices", icon: "$" },
  { href: "/payments", label: "Receipts", icon: "✓" },
  { href: "/services", label: "Services", icon: "⚐" },
  { href: "/custom-fields", label: "Custom fields", icon: "▤" },
  { href: "/chemicals", label: "Chemicals", icon: "⚗" },
  { href: "/mix", label: "Mix calculator", icon: "≋" },
  { href: "/equipment", label: "Equipment", icon: "⚙" },
  { href: "/expenses", label: "Expenses", icon: "−" },
  { href: "/leads", label: "Leads", icon: "★" },
  { href: "/campaigns", label: "Marketing", icon: "📣" },
  { href: "/reports", label: "Reports", icon: "📊" },
  { href: "/messages", label: "Send log", icon: "✉" },
  { href: "/accounting", label: "Accounting sync", icon: "⇄" },
  { href: "/waivers", label: "Waivers", icon: "✍" },
  { href: "/settings", label: "Settings", icon: "⚙" },
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
  notifications = [],
  isPlatformAdmin: isAdmin = false,
  impersonatingOrgId = null,
}: {
  children: React.ReactNode;
  orgName: string;
  userEmail: string;
  isDemo?: boolean;
  badges?: Record<string, number>;
  notifications?: Notification[];
  isPlatformAdmin?: boolean;
  impersonatingOrgId?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const badgeFor = (href: string) => badges?.[href] ?? 0;

  function renderNav(onLeafClick?: () => void) {
    return (
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {NAV.map((item) => {
          const count = badgeFor(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLeafClick}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium",
                isActive(item.href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-700 hover:bg-gray-100",
              )}
            >
              <span className="w-5 text-center text-gray-400">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {count > 0 && <NavBadge count={count} />}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
        <div className="px-4 py-5 flex items-center gap-2 font-bold text-lg border-b">
          <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">{(orgName[0] || "?").toUpperCase()}</span>
          <span className="truncate flex-1">{orgName}</span>
          <NotificationsBell notifications={notifications} align="right" size="sm" />
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
        <div className="flex items-center gap-2 font-bold min-w-0">
          <span className="inline-block w-7 h-7 rounded-lg bg-brand-600 text-white grid place-items-center text-sm flex-shrink-0">{(orgName[0] || "?").toUpperCase()}</span>
          <span className="truncate">{orgName}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <NotificationsBell notifications={notifications} align="right" />
          <Link
            href="/settings"
            aria-label="Settings"
            className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm font-semibold"
          >
            {(userEmail[0] || "?").toUpperCase()}
          </Link>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl flex flex-col">
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
      <main className="flex-1 lg:ml-60 pb-20 lg:pb-0">
        {impersonatingOrgId && (
          <div className="bg-amber-500 text-amber-950 px-4 sm:px-6 py-2 text-xs flex items-center justify-between gap-3">
            <span>
              <strong>👤 Impersonating org</strong> — actions are logged.
            </span>
            <form action="/api/admin/impersonate/stop" method="post">
              <button className="underline font-semibold">Stop impersonating</button>
            </form>
          </div>
        )}
        {isAdmin && !impersonatingOrgId && (
          <div className="bg-slate-900 text-slate-200 px-4 sm:px-6 py-1.5 text-xs flex items-center justify-end gap-3">
            <Link href="/admin" className="hover:text-white underline">→ Platform admin dashboard</Link>
          </div>
        )}
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
        <div className="grid grid-cols-5">
          <BottomTab href="/dashboard" label="Today" active={isActive("/dashboard")} icon={<HomeIcon />} />
          <BottomTab href="/customers" label="Customers" active={isActive("/customers")} icon={<UsersIcon />} />
          <BottomTab href="/jobs" label="Jobs" active={isActive("/jobs")} icon={<BriefcaseIcon />} />
          <BottomTabButton label="Add" onClick={() => setAddOpen(true)} icon={<PlusIcon />} />
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

function NavBadge({ count }: { count: number }) {
  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold leading-none">
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

function BottomTabButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center py-2 text-[11px] font-medium text-gray-500 hover:text-brand-600"
    >
      <span className="w-6 h-6 mb-0.5 grid place-items-center">{icon}</span>
      {label}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
