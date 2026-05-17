"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "./notifications-bell";

type NavItem = { href: string; label: string; icon: string };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/customers", label: "Customers", icon: "♟" },
  { href: "/measure", label: "Measure", icon: "▭" },
  { href: "/estimates", label: "Estimates", icon: "✎" },
  { href: "/jobs", label: "Jobs", icon: "⚒" },
  { href: "/calendar", label: "Calendar", icon: "▤" },
  { href: "/contracts", label: "Contracts", icon: "↻" },
  { href: "/invoices", label: "Invoices", icon: "$" },
  { href: "/payments", label: "Payments", icon: "✓" },
  { href: "/services", label: "Services", icon: "⚐" },
  { href: "/chemicals", label: "Chemicals", icon: "⚗" },
  { href: "/mix", label: "Mix calculator", icon: "≋" },
  { href: "/equipment", label: "Equipment", icon: "⚙" },
  { href: "/expenses", label: "Expenses", icon: "−" },
  { href: "/leads", label: "Leads", icon: "★" },
  { href: "/campaigns", label: "Marketing", icon: "📣" },
  { href: "/reports", label: "Reports", icon: "📊" },
  { href: "/accounting", label: "Accounting sync", icon: "⇄" },
  { href: "/waivers", label: "Waivers", icon: "✍" },
  { href: "/tax", label: "Tax forms", icon: "§" },
  { href: "/audit", label: "Audit log", icon: "⌕" },
  { href: "/team", label: "Team", icon: "♛" },
  { href: "/billing", label: "Billing", icon: "♢" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

const MOBILE_TABS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "▦" },
  { href: "/estimates", label: "Estimates", icon: "✎" },
  { href: "/jobs", label: "Jobs", icon: "⚒" },
  { href: "/customers", label: "Customers", icon: "♟" },
  { href: "/invoices", label: "Invoices", icon: "$" },
];

export function AppShell({
  children,
  orgName,
  orgLogo,
  userEmail,
  isDemo,
  badges,
}: {
  children: React.ReactNode;
  orgName: string;
  orgLogo?: string | null;
  userEmail: string;
  isDemo?: boolean;
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const badgeFor = (href: string) => badges?.[href] ?? 0;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Desktop top bar (notifications + sign out hook) */}
      <header className="hidden lg:flex fixed top-0 inset-x-0 z-30 h-12 bg-white border-b border-gray-200 lg:pl-60 px-4 items-center justify-end gap-3">
        <NotificationsBell />
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200 z-40">
        <div className="px-4 py-5 flex items-center gap-2 font-bold text-lg border-b">
          {orgLogo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={orgLogo} alt="" className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">S</span>
          )}
          <span className="truncate">{orgName}</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV.map((item) => {
            const count = badgeFor(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
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
          {orgLogo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={orgLogo} alt="" className="w-7 h-7 rounded-lg object-cover" />
          ) : (
            <span className="inline-block w-7 h-7 rounded-lg bg-brand-600 text-white grid place-items-center text-sm">S</span>
          )}
          <span className="truncate max-w-[180px]">{orgName}</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationsBell />
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
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-72 bg-white shadow-xl flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <span className="font-bold">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="p-2 -mr-2" aria-label="Close menu">✕</button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {NAV.map((item) => {
                const count = badgeFor(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium",
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
      <main className="flex-1 lg:ml-60 lg:pt-12 pb-20 lg:pb-0">
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
    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}
