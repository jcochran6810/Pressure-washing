import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

// Tiny markdown renderer: paragraphs, **bold**, *italic*, [link](url), `code`, lists, headings.
// Keeps deps minimal. If we ever need full markdown, swap in remark.
function renderMarkdown(md: string): string {
  const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  // Process line by line for headings, lists, paragraphs
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inUl = false, inOl = false;

  function inline(s: string) {
    let r = escape(s);
    r = r.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-xs">$1</code>');
    r = r.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    r = r.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-brand-600 underline">$1</a>');
    return r;
  }

  function flushLists() {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushLists(); continue; }
    if (line.startsWith("### ")) { flushLists(); out.push(`<h3 class="font-semibold text-base mt-4 mb-1">${inline(line.slice(4))}</h3>`); continue; }
    if (line.startsWith("## ")) { flushLists(); out.push(`<h2 class="font-semibold text-lg mt-4 mb-1">${inline(line.slice(3))}</h2>`); continue; }
    if (line.startsWith("# ")) { flushLists(); out.push(`<h1 class="font-bold text-xl mt-4 mb-2">${inline(line.slice(2))}</h1>`); continue; }
    if (/^[-*] /.test(line)) {
      if (!inUl) { flushLists(); out.push('<ul class="list-disc pl-6 my-2 space-y-1">'); inUl = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`); continue;
    }
    if (/^\d+\.\s/.test(line)) {
      if (!inOl) { flushLists(); out.push('<ol class="list-decimal pl-6 my-2 space-y-1">'); inOl = true; }
      out.push(`<li>${inline(line.replace(/^\d+\.\s/, ""))}</li>`); continue;
    }
    flushLists();
    out.push(`<p class="my-2 leading-relaxed">${inline(line)}</p>`);
  }
  flushLists();
  return out.join("");
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = publicClient();
  const { data: article } = await supabase
    .from("help_articles")
    .select("title, summary, body_markdown, category, updated_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!article) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="inline-block w-7 h-7 rounded-lg bg-brand-600 text-white grid place-items-center text-sm">{BRAND.name.charAt(0)}</span>
            {BRAND.name}
          </Link>
          <Link href="/help" className="text-sm text-brand-600 hover:underline">← All articles</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{article.category}</p>
        <h1 className="text-3xl font-bold mb-1">{article.title}</h1>
        {article.summary && <p className="text-gray-600 mb-6">{article.summary}</p>}

        <article
          className="card-padded text-sm text-gray-800"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body_markdown) }}
        />

        <div className="mt-6 card-padded text-sm">
          <p>Still stuck? Email <a href="mailto:support@yourdomain.com" className="text-brand-600">support@yourdomain.com</a> — we read every message.</p>
        </div>
      </main>
    </div>
  );
}
