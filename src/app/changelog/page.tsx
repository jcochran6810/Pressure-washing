import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // re-render hourly

// Tiny markdown → HTML for the changelog only. Supports headings, lists,
// bold/italic, links, hr, and paragraphs. Avoids pulling a markdown lib.
function renderMarkdown(md: string): string {
  const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
  const inline = (s: string) => {
    let r = escape(s);
    r = r.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-xs">$1</code>');
    r = r.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    r = r.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    r = r.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-brand-600 underline">$1</a>');
    return r;
  };
  const out: string[] = [];
  let inUl = false;
  const flush = () => { if (inUl) { out.push("</ul>"); inUl = false; } };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (/^---+$/.test(line)) { flush(); out.push('<hr class="my-6 border-gray-200" />'); continue; }
    if (line.startsWith("### ")) { flush(); out.push(`<h3 class="font-semibold text-sm uppercase tracking-wider text-gray-500 mt-5 mb-2">${inline(line.slice(4))}</h3>`); continue; }
    if (line.startsWith("## ")) { flush(); out.push(`<h2 class="font-bold text-xl mt-8 mb-2">${inline(line.slice(3))}</h2>`); continue; }
    if (line.startsWith("# ")) { flush(); continue; /* title is page header */ }
    if (line.startsWith("- ")) {
      if (!inUl) { out.push('<ul class="list-disc pl-6 space-y-1.5 my-2">'); inUl = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    flush();
    out.push(`<p class="my-2 leading-relaxed text-gray-700">${inline(line)}</p>`);
  }
  flush();
  return out.join("");
}

export default async function ChangelogPage() {
  let md = "";
  try {
    const file = path.join(process.cwd(), "CHANGELOG.md");
    md = await readFile(file, "utf8");
  } catch {
    md = "# Changelog\n\nNo entries yet.";
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
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Changelog</h1>
        <p className="text-gray-600 mb-6">What&apos;s new in {BRAND.name}.</p>
        <article
          className="card-padded"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(md) }}
        />
      </main>
    </div>
  );
}
