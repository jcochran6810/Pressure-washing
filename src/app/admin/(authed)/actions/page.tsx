import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogPage() {
  const supabase = await createClient();
  const { data: actions } = await supabase
    .from("admin_actions")
    .select("id, admin_user_id, action, target_kind, target_id, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">Audit log</h1>
      <p className="text-sm text-gray-500 mb-4">Every admin action — impersonation, disable/enable, plan adjustment, admin grants/revokes.</p>

      <section className="card overflow-hidden">
        <table className="data-table">
          <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Payload</th></tr></thead>
          <tbody>
            {(actions ?? []).map((a: any) => {
              const targetHref =
                a.target_kind === "organization" ? `/admin/companies/${a.target_id}` :
                a.target_kind === "user" ? `/admin/users` :
                null;
              return (
                <tr key={a.id}>
                  <td className="text-xs whitespace-nowrap">{formatDate(a.created_at)}</td>
                  <td className="font-mono text-xs">{a.admin_user_id?.slice(0, 8)}…</td>
                  <td className="font-mono text-xs">{a.action}</td>
                  <td className="text-xs">
                    {targetHref ? (
                      <Link href={targetHref} className="text-brand-700 hover:underline">{a.target_kind}: {a.target_id?.slice(0, 8)}…</Link>
                    ) : (
                      <span>{a.target_kind ?? "—"}</span>
                    )}
                  </td>
                  <td className="text-xs text-gray-600 max-w-[400px] truncate">{a.payload ? JSON.stringify(a.payload) : "—"}</td>
                </tr>
              );
            })}
            {(actions ?? []).length === 0 && (
              <tr><td colSpan={5} className="text-center text-gray-500 py-8">No admin actions recorded.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
