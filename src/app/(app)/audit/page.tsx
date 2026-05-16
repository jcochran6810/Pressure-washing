import { getSessionAndOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string; action?: string }> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { entity, action } = await searchParams;

  let q = supabase
    .from("audit_log")
    .select("id, actor_email, action, entity_type, entity_id, entity_label, before_data, after_data, ip, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (entity) q = q.eq("entity_type", entity);
  if (action) q = q.eq("action", action);

  const { data: events } = await q;

  const filterChip = (label: string, href: string, active: boolean) => (
    <a key={label} href={href} className={`badge text-xs ${active ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>{label}</a>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Audit log</h1>
          <p className="text-sm text-gray-500 mt-1">Every important change anyone made in your organization. Last 200 events shown.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="text-xs text-gray-500 mr-1">Filter:</span>
        {filterChip("All", "/audit", !entity && !action)}
        {filterChip("Invoices", "/audit?entity=invoice", entity === "invoice")}
        {filterChip("Estimates", "/audit?entity=estimate", entity === "estimate")}
        {filterChip("Payments", "/audit?action=pay", action === "pay")}
        {filterChip("Deletions", "/audit?action=delete", action === "delete")}
        {filterChip("Integrations", "/audit?entity=integration", entity === "integration")}
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Label</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {!events?.length ? (
              <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-500">No audit events yet.</td></tr>
            ) : events.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap text-xs text-gray-500">{new Date(e.created_at!).toLocaleString()}</td>
                <td className="text-sm">{e.actor_email || <span className="text-gray-400">system</span>}</td>
                <td><span className={`badge ${actionColor(e.action)}`}>{e.action}</span></td>
                <td className="text-sm capitalize">{e.entity_type}</td>
                <td className="text-sm">{e.entity_label || <span className="text-gray-400">—</span>}</td>
                <td className="text-xs text-gray-500 max-w-xs">
                  {e.after_data && Object.keys(e.after_data as any).length > 0 && (
                    <details><summary className="cursor-pointer">view changes</summary><pre className="mt-1 p-2 bg-gray-50 rounded overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(e.after_data, null, 2)}</pre></details>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function actionColor(a: string) {
  if (a === "delete") return "bg-red-100 text-red-700";
  if (a === "pay") return "bg-green-100 text-green-700";
  if (a === "send") return "bg-blue-100 text-blue-700";
  if (a === "create") return "bg-emerald-100 text-emerald-700";
  if (a === "connect") return "bg-purple-100 text-purple-700";
  if (a === "disconnect") return "bg-orange-100 text-orange-700";
  return "bg-gray-100 text-gray-700";
}
