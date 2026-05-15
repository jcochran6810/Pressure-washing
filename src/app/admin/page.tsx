import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const supabase = await createClient();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const [
    { count: orgCount },
    { count: userCount },
    { count: trialCount },
    { count: disabledCount },
    { count: errorCount24h },
    { data: recentOrgs },
    { data: monthPayments },
    { count: emailMonth },
    { count: smsMonth },
  ] = await Promise.all([
    supabase.from("organizations").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("organizations").select("*", { count: "exact", head: true }).gt("trial_ends_at", new Date().toISOString()),
    supabase.from("organizations").select("*", { count: "exact", head: true }).not("disabled_at", "is", null),
    supabase.from("app_errors").select("*", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
    supabase.from("organizations").select("id, name, created_at, subscription_tier, subscription_status").order("created_at", { ascending: false }).limit(8),
    supabase.from("payments").select("amount").gte("payment_date", monthStart.toISOString().slice(0, 10)),
    supabase.from("email_log").select("*", { count: "exact", head: true }).gte("sent_at", monthStart.toISOString()),
    (supabase as any).from("sms_log").select("*", { count: "exact", head: true }).gte("sent_at", monthStart.toISOString()),
  ]);

  const monthlyRevenue = (monthPayments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Platform overview</h1>
      <p className="text-sm text-gray-500 mb-5">Cross-org snapshot. Drill into any section from the nav.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Kpi label="Companies" value={String(orgCount ?? 0)} sub={`${disabledCount ?? 0} disabled`} />
        <Kpi label="Users" value={String(userCount ?? 0)} />
        <Kpi label="In trial" value={String(trialCount ?? 0)} />
        <Kpi label="Errors (24h)" value={String(errorCount24h ?? 0)} tone={errorCount24h && errorCount24h > 0 ? "warn" : "ok"} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Kpi label="Payments this month" value={formatCurrency(monthlyRevenue)} />
        <Kpi label="Emails sent (month)" value={String(emailMonth ?? 0)} />
        <Kpi label="SMS sent (month)" value={String(smsMonth ?? 0)} />
      </div>

      <section className="card">
        <header className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold">Newest companies</h2>
          <Link href="/admin/companies" className="text-xs text-brand-700 hover:underline">All companies →</Link>
        </header>
        <table className="data-table">
          <thead><tr><th>Name</th><th>Tier</th><th>Status</th><th>Joined</th></tr></thead>
          <tbody>
            {(recentOrgs ?? []).map((o: any) => (
              <tr key={o.id}>
                <td><Link href={`/admin/companies/${o.id}`} className="text-brand-700 hover:underline">{o.name}</Link></td>
                <td className="capitalize">{o.subscription_tier}</td>
                <td className="text-xs">{o.subscription_status ?? "—"}</td>
                <td className="text-xs text-gray-500">{o.created_at ? formatDate(o.created_at) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  return (
    <div className="card-padded">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-green-700" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
