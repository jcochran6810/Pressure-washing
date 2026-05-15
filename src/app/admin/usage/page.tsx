import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export default async function AdminUsagePage() {
  const supabase = await createClient();

  // Email + SMS counts for current month, prior month, all-time.
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const lastMonthStart = new Date(monthStart); lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

  const [
    { count: emailMonth },
    { count: emailLast },
    { count: emailAll },
    { count: smsMonth },
    { count: smsLast },
    { count: smsAll },
    { data: dbSizes, error: dbErr },
    { data: topSenders },
  ] = await Promise.all([
    supabase.from("email_log").select("*", { count: "exact", head: true }).gte("sent_at", monthStart.toISOString()),
    supabase.from("email_log").select("*", { count: "exact", head: true }).gte("sent_at", lastMonthStart.toISOString()).lt("sent_at", monthStart.toISOString()),
    supabase.from("email_log").select("*", { count: "exact", head: true }),
    (supabase as any).from("sms_log").select("*", { count: "exact", head: true }).gte("sent_at", monthStart.toISOString()),
    (supabase as any).from("sms_log").select("*", { count: "exact", head: true }).gte("sent_at", lastMonthStart.toISOString()).lt("sent_at", monthStart.toISOString()),
    (supabase as any).from("sms_log").select("*", { count: "exact", head: true }),
    (supabase as any).rpc("admin_table_sizes_check"),
    supabase
      .from("email_log")
      .select("organization_id, organizations(name)")
      .gte("sent_at", monthStart.toISOString())
      .limit(5000),
  ]);

  const senderCounts = new Map<string, { name: string; count: number }>();
  for (const e of (topSenders as any[]) ?? []) {
    if (!e.organization_id) continue;
    const cur = senderCounts.get(e.organization_id) ?? { name: e.organizations?.name ?? "—", count: 0 };
    cur.count += 1;
    senderCounts.set(e.organization_id, cur);
  }
  const topSendersList = Array.from(senderCounts.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const totalDbBytes = (dbSizes as any[] ?? []).reduce((s, r) => s + Number(r.size_bytes ?? 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">Platform usage</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Kpi label="Email this month" value={String(emailMonth ?? 0)} sub={`last month: ${emailLast ?? 0}`} />
        <Kpi label="SMS this month" value={String(smsMonth ?? 0)} sub={`last month: ${smsLast ?? 0}`} />
        <Kpi label="Database size" value={formatBytes(totalDbBytes)} sub={`${dbSizes?.length ?? 0} tables`} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Kpi label="Email all-time" value={String(emailAll ?? 0)} />
        <Kpi label="SMS all-time" value={String(smsAll ?? 0)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <section className="card overflow-hidden">
          <header className="px-4 py-3 border-b">
            <h2 className="font-semibold">Top senders this month</h2>
            <p className="text-xs text-gray-500">Orgs by email volume.</p>
          </header>
          <table className="data-table">
            <thead><tr><th>Company</th><th className="text-right">Emails</th></tr></thead>
            <tbody>
              {topSendersList.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="text-right">{s.count}</td>
                </tr>
              ))}
              {topSendersList.length === 0 && <tr><td colSpan={2} className="text-center text-gray-500 py-4">No sends yet.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="card overflow-hidden">
          <header className="px-4 py-3 border-b">
            <h2 className="font-semibold">Database table sizes</h2>
            <p className="text-xs text-gray-500">Total relation size including indexes + TOAST.</p>
          </header>
          {dbErr && <p className="p-4 text-sm text-red-600">Couldn't load: {dbErr.message}</p>}
          <table className="data-table">
            <thead><tr><th>Table</th><th className="text-right">Rows</th><th className="text-right">Size</th></tr></thead>
            <tbody>
              {(dbSizes as any[] ?? []).slice(0, 20).map((r) => (
                <tr key={r.table_name}>
                  <td className="font-mono text-xs">{r.table_name}</td>
                  <td className="text-right text-xs">{Number(r.row_estimate).toLocaleString()}</td>
                  <td className="text-right text-xs">{formatBytes(Number(r.size_bytes))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card-padded">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
