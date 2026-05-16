import Link from "next/link";

export const dynamic = "force-dynamic";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="inline-block w-7 h-7 rounded-lg bg-brand-600 text-white grid place-items-center text-sm">S</span>
            Suds
          </Link>
          <nav className="text-xs flex flex-wrap gap-x-3 gap-y-1">
            <Link href="/legal/terms" className="text-gray-600 hover:text-gray-900">Terms</Link>
            <Link href="/legal/privacy" className="text-gray-600 hover:text-gray-900">Privacy</Link>
            <Link href="/legal/dpa" className="text-gray-600 hover:text-gray-900">DPA</Link>
            <Link href="/legal/sms-consent" className="text-gray-600 hover:text-gray-900">SMS</Link>
            <Link href="/legal/refund" className="text-gray-600 hover:text-gray-900">Refund</Link>
            <Link href="/legal/acceptable-use" className="text-gray-600 hover:text-gray-900">AUP</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        <article className="prose prose-sm max-w-none bg-white border border-gray-200 rounded-lg p-6 sm:p-8 [&_h2]:font-semibold [&_h2]:text-lg [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:my-2 [&_li]:my-0.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6">
          {children}
        </article>
      </main>
      <footer className="border-t border-gray-200 bg-white px-4 py-4 text-xs text-gray-500 text-center">
        © {new Date().getFullYear()} Suds. All rights reserved.
      </footer>
    </div>
  );
}
