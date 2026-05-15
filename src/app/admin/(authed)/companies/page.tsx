import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "all" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("organizations")
    .select("id, name, slug, subscription_tier, subscription_status, trial_ends_at, disabled_at, created_at, business_type_id, email, phone")
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) query = query.ilike("name", `%${q}%`);
  if (status === "disabled") query = query.not("disabled_at", "is", null);
  if (status === "trial") query = query.gt("trial_ends_at", new Date().toISOString());
  if (status === "active") query = query.eq("subscription_status", "active");
  if (status === "expired") query = query.eq("subscription_status", "trial_expired");

  const { data: orgs } = await query;

  function chip(label: string, key: "status", value: string, active: string) {
    const isActive = active === value;
    const params = new URLSearchParams({ q, status: value });
    return (
      <Link
        href={`/admin/companies?${params.toString()}`}
        className={`px-3 py-1 rounded text-xs ${isActive ? "bg-slate-900 text-white" : "bg-white border border-gray-200 text-gray-700"}`}
      >{label}</Link>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">Companies</h1>

      <form className="card-padded mb-4 flex flex-wrap gap-3 items-center">
        <input name="q" defaultValue={q} placeholder="Search by name…" className="flex-1 min-w-[200px]" />
        <input type="hidden" name="status" value={status} />
        <button className="btn-secondary text-sm">Search</button>
      </form>

      <div className="flex flex-wrap gap-2 mb-4">
        {chip("All", "status", "all", status)}
        {chip("Active", "status", "active", status)}
        {chip("In trial", "status", "trial", status)}
        {chip("Trial expired", "status", "expired", status)}
        {chip("Disabled", "status", "disabled", status)}
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Trade</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Trial ends</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(orgs ?? []).map((o: any) => (
              <tr key={o.id} className={o.disabled_at ? "bg-red-50" : ""}>
                <td>
                  <Link href={`/admin/companies/${o.id}`} className="text-brand-700 hover:underline font-medium">{o.name}</Link>
                  <div className="text-xs text-gray-400">{o.email ?? ""} {o.phone ? `· ${o.phone}` : ""}</div>
                </td>
                <td className="text-xs">{o.business_type_id?.replace(/_/g, " ")}</td>
                <td className="capitalize">{o.subscription_tier}</td>
                <td>
                  {o.disabled_at ? <span className="badge bg-red-100 text-red-700">disabled</span>
                    : o.subscription_status === "active" ? <span className="badge bg-green-100 text-green-700">active</span>
                    : o.subscription_status === "trial_expired" ? <span className="badge bg-amber-100 text-amber-700">trial ended</span>
                    : o.trial_ends_at && new Date(o.trial_ends_at) > new Date() ? <span className="badge bg-blue-100 text-blue-700">trialing</span>
                    : <span className="badge bg-gray-100 text-gray-700">{o.subscription_status ?? "unknown"}</span>}
                </td>
                <td className="text-xs">{o.trial_ends_at ? formatDate(o.trial_ends_at) : "—"}</td>
                <td className="text-xs text-gray-500">{o.created_at ? formatDate(o.created_at) : "—"}</td>
                <td className="text-right">
                  <Link href={`/admin/companies/${o.id}`} className="text-xs text-brand-700 hover:underline">Open →</Link>
                </td>
              </tr>
            ))}
            {(orgs ?? []).length === 0 && (
              <tr><td colSpan={7} className="text-center text-gray-500 py-8">No companies match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
