import Link from "next/link";
import { requirePlatformAdmin, getImpersonatedOrgId } from "@/lib/admin";
import { PLATFORM_NAME } from "@/lib/platform";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/companies", label: "Companies" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/usage", label: "Usage" },
  { href: "/admin/errors", label: "Errors" },
  { href: "/admin/actions", label: "Audit log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePlatformAdmin();
  const impersonating = await getImpersonatedOrgId();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          <Link href="/admin" className="font-bold tracking-wide">
            <span className="text-red-400">●</span> {PLATFORM_NAME} Admin
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="px-3 py-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
            <span>{ctx.email}</span>
            <Link href="/dashboard" className="text-slate-300 hover:text-white">Back to app →</Link>
          </div>
        </div>
        {impersonating && (
          <div className="bg-amber-500 text-amber-950 text-center text-sm py-2 px-4">
            <strong>You're impersonating org {impersonating}.</strong> Anything you do is recorded.{" "}
            <form action="/api/admin/impersonate/stop" method="post" className="inline">
              <button className="underline font-semibold">Stop impersonating</button>
            </form>
          </div>
        )}
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
