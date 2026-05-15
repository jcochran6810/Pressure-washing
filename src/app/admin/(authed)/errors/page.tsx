import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; q?: string }>;
}) {
  const { severity = "all", q = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("app_errors")
    .select("id, organization_id, user_id, route, message, severity, created_at, context, organizations(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (severity !== "all") query = query.eq("severity", severity);
  if (q) query = query.ilike("message", `%${q}%`);

  const { data: errors } = await query;

  function chip(label: string, value: string) {
    const isActive = severity === value;
    const params = new URLSearchParams({ q, severity: value });
    return (
      <Link href={`/admin/errors?${params.toString()}`} className={`px-3 py-1 rounded text-xs ${isActive ? "bg-slate-900 text-white" : "bg-white border border-gray-200"}`}>
        {label}
      </Link>
    );
  }

  function sevBadge(s: string) {
    const cls = s === "fatal" ? "bg-red-100 text-red-700" : s === "error" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700";
    return <span className={`badge ${cls}`}>{s}</span>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">App errors</h1>
      <p className="text-sm text-gray-500 mb-4">
        Server-side errors logged via <code className="text-xs bg-gray-100 px-1 rounded">logAppError()</code>.
        Tail your platform host (Vercel) logs for raw stack traces.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {chip("All", "all")}
        {chip("Warn", "warn")}
        {chip("Error", "error")}
        {chip("Fatal", "fatal")}
      </div>

      <form className="card-padded mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search messages…" className="flex-1" />
        <input type="hidden" name="severity" value={severity} />
        <button className="btn-secondary text-sm">Search</button>
      </form>

      <section className="card overflow-hidden">
        <table className="data-table">
          <thead><tr><th>When</th><th>Sev</th><th>Route</th><th>Company</th><th>Message</th></tr></thead>
          <tbody>
            {(errors ?? []).map((e: any) => (
              <tr key={e.id}>
                <td className="text-xs whitespace-nowrap">{formatDate(e.created_at)}</td>
                <td>{sevBadge(e.severity ?? "error")}</td>
                <td className="text-xs font-mono">{e.route ?? "—"}</td>
                <td className="text-xs">{e.organizations?.name ?? (e.organization_id ? "(unknown)" : "—")}</td>
                <td className="text-xs max-w-[480px] truncate" title={e.message}>{e.message}</td>
              </tr>
            ))}
            {(errors ?? []).length === 0 && (
              <tr><td colSpan={5} className="text-center text-gray-500 py-8">No errors logged.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
