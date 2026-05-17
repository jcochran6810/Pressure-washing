import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { BRAND } from "@/lib/brand";
import { HelpSearch } from "./help-search";

export const dynamic = "force-dynamic";

function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = publicClient();
  let query = supabase
    .from("help_articles")
    .select("id, slug, category, title, summary, sort_order")
    .eq("is_published", true)
    .order("category")
    .order("sort_order");
  if (q && q.trim().length > 0) {
    const term = `%${q.trim()}%`;
    query = query.or(`title.ilike.${term},summary.ilike.${term},body_markdown.ilike.${term}`);
  }
  const { data: articles } = await query;

  const byCategory = new Map<string, typeof articles>();
  for (const a of articles ?? []) {
    const arr = byCategory.get(a.category) || [];
    arr.push(a as any);
    byCategory.set(a.category, arr as any);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="inline-block w-7 h-7 rounded-lg bg-brand-600 text-white grid place-items-center text-sm">{BRAND.name.charAt(0)}</span>
            {BRAND.name}
          </Link>
          <nav className="text-sm flex gap-3">
            <Link href="/help" className="text-gray-600 hover:text-gray-900">Help</Link>
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900">Pricing</Link>
            <Link href="/login" className="text-brand-600 hover:underline">Log in</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Help center</h1>
        <p className="text-gray-600 mb-6">
          Quick answers to the most common questions. Can&apos;t find what you need?
          Email <a href="mailto:support@yourdomain.com" className="text-brand-600">support@yourdomain.com</a>.
        </p>

        <HelpSearch initialQuery={q ?? ""} />

        {(!articles || articles.length === 0) ? (
          <p className="card-padded text-sm text-gray-500 mt-6">
            {q ? `No results for "${q}".` : "No help articles yet."}
          </p>
        ) : (
          <div className="space-y-6 mt-6">
            {Array.from(byCategory.entries()).map(([cat, list]) => (
              <section key={cat} className="card-padded">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">{cat}</h2>
                <ul className="space-y-2">
                  {(list as any[]).map((a) => (
                    <li key={a.id}>
                      <Link href={`/help/${a.slug}`} className="block hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded">
                        <p className="font-medium text-gray-900">{a.title}</p>
                        {a.summary && <p className="text-sm text-gray-600">{a.summary}</p>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
