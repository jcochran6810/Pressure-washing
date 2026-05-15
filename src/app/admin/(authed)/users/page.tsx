import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { grantPlatformAdmin, revokePlatformAdmin } from "../actions";
import { requirePlatformAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePlatformAdmin();
  const { q = "" } = await searchParams;
  const supabase = await createClient();

  let userQ = supabase
    .from("profiles")
    .select("id, full_name, default_organization_id, organizations:default_organization_id(name)")
    .order("full_name")
    .limit(200);
  if (q) userQ = userQ.ilike("full_name", `%${q}%`);

  const [{ data: profiles }, { data: admins }] = await Promise.all([
    userQ,
    supabase.from("platform_admins").select("user_id, granted_at, notes"),
  ]);

  const adminSet = new Set((admins ?? []).map((a: any) => a.user_id));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">Users</h1>

      <form className="card-padded mb-4 flex flex-wrap gap-3 items-center">
        <input name="q" defaultValue={q} placeholder="Search by name…" className="flex-1 min-w-[200px]" />
        <button className="btn-secondary text-sm">Search</button>
      </form>

      <section className="card overflow-hidden mb-5">
        <header className="px-4 py-3 border-b">
          <h2 className="font-semibold">Platform admins ({(admins ?? []).length})</h2>
          <p className="text-xs text-gray-500">Anyone in this list can access /admin.</p>
        </header>
        <table className="data-table">
          <thead><tr><th>User</th><th>Granted</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            {(admins ?? []).map((a: any) => (
              <tr key={a.user_id}>
                <td className="font-mono text-xs">{a.user_id}</td>
                <td className="text-xs">{formatDate(a.granted_at)}</td>
                <td className="text-xs text-gray-500">{a.notes ?? "—"}</td>
                <td className="text-right">
                  <form action={revokePlatformAdmin}>
                    <input type="hidden" name="user_id" value={a.user_id} />
                    <button className="text-xs text-red-600 hover:underline">Revoke</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t bg-gray-50">
          <form action={grantPlatformAdmin} className="flex flex-wrap gap-2 items-center">
            <input name="user_id" placeholder="user UUID" className="flex-1 min-w-[280px] font-mono text-xs" required />
            <input name="notes" placeholder="reason / notes (optional)" className="flex-1 min-w-[200px]" />
            <button className="btn-primary text-xs">Grant admin</button>
          </form>
        </div>
      </section>

      <section className="card overflow-hidden">
        <header className="px-4 py-3 border-b"><h2 className="font-semibold">All users</h2></header>
        <table className="data-table">
          <thead><tr><th>Name</th><th>User ID</th><th>Default org</th><th>Admin?</th></tr></thead>
          <tbody>
            {(profiles ?? []).map((p: any) => (
              <tr key={p.id}>
                <td>{p.full_name ?? <em className="text-gray-400">(no name)</em>}</td>
                <td className="font-mono text-xs">{p.id}</td>
                <td className="text-xs">{p.organizations?.name ?? "—"}</td>
                <td>{adminSet.has(p.id) ? <span className="badge bg-purple-100 text-purple-700">admin</span> : null}</td>
              </tr>
            ))}
            {(profiles ?? []).length === 0 && (
              <tr><td colSpan={4} className="text-center text-gray-500 py-8">No users match.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
