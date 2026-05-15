import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, subscription_tier, subscription_status, trial_ends_at, quota_addons, stripe_subscription_id, disabled_at, created_at")
    .order("subscription_status", { nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);

  const tierPrices: Record<string, number> = { basic: 5, plus: 15, pro: 45 };
  let mrr = 0;
  const counts: Record<string, number> = { basic: 0, plus: 0, pro: 0 };
  const statusCounts: Record<string, number> = {};
  for (const o of (orgs as any[]) ?? []) {
    if (o.disabled_at) continue;
    if (o.subscription_status === "active" || o.subscription_status === "trialing") {
      mrr += tierPrices[o.subscription_tier] ?? 0;
      counts[o.subscription_tier] = (counts[o.subscription_tier] ?? 0) + 1;
    }
    statusCounts[o.subscription_status ?? "none"] = (statusCounts[o.subscription_status ?? "none"] ?? 0) + 1;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">Subscriptions</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Kpi label="Estimated MRR" value={`$${mrr.toFixed(0)}`} />
        <Kpi label="Basic" value={String(counts.basic ?? 0)} />
        <Kpi label="Plus" value={String(counts.plus ?? 0)} />
        <Kpi label="Pro" value={String(counts.pro ?? 0)} />
      </div>

      <section className="card mb-5">
        <header className="px-4 py-3 border-b"><h2 className="font-semibold">Status breakdown</h2></header>
        <ul className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
            <li key={s} className="flex justify-between border-b border-gray-100 py-1">
              <span className="text-gray-600">{s}</span>
              <span className="font-medium">{n}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card overflow-hidden">
        <header className="px-4 py-3 border-b"><h2 className="font-semibold">All subscriptions</h2></header>
        <table className="data-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Tier</th>
              <th>Status</th>
              <th>Trial ends</th>
              <th>Add-ons</th>
              <th>Stripe sub</th>
            </tr>
          </thead>
          <tbody>
            {(orgs ?? []).map((o: any) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/admin/companies/${o.id}`} className="text-brand-700 hover:underline">{o.name}</Link>
                </td>
                <td className="capitalize">{o.subscription_tier}</td>
                <td className="text-xs">{o.subscription_status ?? "—"}</td>
                <td className="text-xs">{o.trial_ends_at ? formatDate(o.trial_ends_at) : "—"}</td>
                <td>{o.quota_addons ?? 0}</td>
                <td className="font-mono text-xs">{o.stripe_subscription_id ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-padded">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
