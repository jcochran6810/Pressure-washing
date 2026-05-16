import Link from "next/link";

export const dynamic = "force-dynamic";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-2 font-bold">
            <span className="inline-block w-7 h-7 rounded-lg bg-brand-600 text-white grid place-items-center text-sm">S</span>
            Customer portal
          </Link>
          <form action="/api/portal/signout" method="post">
            <button className="text-xs text-gray-600 hover:text-gray-900">Sign out</button>
          </form>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
