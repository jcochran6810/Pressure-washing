import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { formatCurrency, formatDate, customerDisplayName, statusColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, organizationId } = await getSessionAndOrg();

  const now = new Date();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  const followUpCutoff = new Date(); followUpCutoff.setDate(followUpCutoff.getDate() - 3); // estimates sent 3+ days ago without action

  const [
    { count: customerCount },
    { count: unpaidCount },
    { count: overdueCount },
    { count: draftCount },
    { count: newLeadCount },
    { data: openInvoices },
    { data: overdueInvoices },
    { data: upcomingJobs },
    { data: todayJobs },
    { data: recentLeads },
    { data: monthPayments },
    { data: monthExpenses },
    { data: lowStock },
    { data: followUpEstimates },
    { data: serviceDueEquip },
  ] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["sent", "partial", "overdue"]),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "overdue"),
    supabase.from("estimates").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "draft"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "new"),
    supabase.from("invoices").select("id, invoice_number, total, balance_due, status, due_date, customers(first_name, last_name, company_name)").eq("organization_id", organizationId).in("status", ["sent", "partial", "overdue"]).order("due_date", { ascending: true }).limit(5),
    supabase.from("invoices").select("id, invoice_number, balance_due, due_date").eq("organization_id", organizationId).eq("status", "overdue").order("due_date").limit(5),
    supabase.from("jobs").select("id, title, scheduled_start, status, total_amount, customers(first_name, last_name, company_name)").eq("organization_id", organizationId).gte("scheduled_start", now.toISOString()).lte("scheduled_start", weekEnd.toISOString()).order("scheduled_start", { ascending: true }).limit(8),
    supabase.from("jobs").select("id, title, scheduled_start, status").eq("organization_id", organizationId).gte("scheduled_start", todayStart.toISOString()).lt("scheduled_start", new Date(todayStart.getTime() + 86400000).toISOString()),
    supabase.from("leads").select("id, first_name, last_name, phone, status, created_at, estimated_value").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(5),
    supabase.from("payments").select("amount").eq("organization_id", organizationId).gte("payment_date", monthStart.toISOString().slice(0, 10)),
    supabase.from("expenses").select("amount").eq("organization_id", organizationId).gte("expense_date", monthStart.toISOString().slice(0, 10)),
    supabase.from("chemicals").select("id, name, current_stock, reorder_level, unit").eq("organization_id", organizationId),
    supabase.from("estimates").select("id, estimate_number, status, total, sent_at, issue_date, customers(first_name, last_name, company_name)").eq("organization_id", organizationId).eq("status", "sent").lte("sent_at", followUpCutoff.toISOString()).order("sent_at").limit(5),
    supabase.from("equipment").select("id, name, next_service_date").eq("organization_id", organizationId).not("next_service_date", "is", null).lte("next_service_date", new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)).order("next_service_date").limit(5),
  ]);

  const revenueMTD = (monthPayments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const expenseMTD = (monthExpenses ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const profitMTD = revenueMTD - expenseMTD;
  const outstanding = (openInvoices ?? []).reduce((s, i) => s + Number(i.balance_due ?? 0), 0);
  const lowStockItems = (lowStock ?? []).filter((c) => (c.current_stock ?? 0) <= (c.reorder_level ?? 0));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p>
      </div>

      {/* Top stats — accounting focus */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <KpiCard label="Revenue MTD" value={formatCurrency(revenueMTD)} tone="ok" />
        <KpiCard label="Expenses MTD" value={formatCurrency(expenseMTD)} />
        <KpiCard label="Profit MTD" value={formatCurrency(profitMTD)} tone={profitMTD >= 0 ? "ok" : "warn"} />
        <KpiCard label="A/R outstanding" value={formatCurrency(outstanding)} sub={`${unpaidCount ?? 0} unpaid`} tone={outstanding > 0 ? "warn" : undefined} />
      </div>

      {/* Action items strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <ActionStat label="Unpaid invoices" count={unpaidCount ?? 0} href="/invoices?status=sent" tone={(unpaidCount ?? 0) > 0 ? "warn" : "ok"} />
        <ActionStat label="Overdue" count={overdueCount ?? 0} href="/invoices?status=overdue" tone={(overdueCount ?? 0) > 0 ? "alert" : "ok"} />
        <ActionStat label="Estimates to follow up" count={followUpEstimates?.length ?? 0} href="/estimates" tone={(followUpEstimates?.length ?? 0) > 0 ? "warn" : "ok"} />
        <ActionStat label="Draft estimates" count={draftCount ?? 0} href="/estimates" />
        <ActionStat label="New leads" count={newLeadCount ?? 0} href="/leads" tone={(newLeadCount ?? 0) > 0 ? "warn" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <section className="card">
          <header className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold">This week's jobs</h2>
            <Link href="/jobs" className="text-sm text-brand-600 hover:underline">View all</Link>
          </header>
          {!upcomingJobs?.length ? (
            <p className="p-6 text-sm text-gray-500">No jobs scheduled this week.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {upcomingJobs.map((j: any) => (
                <li key={j.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{j.title}</p>
                    <p className="text-xs text-gray-500 truncate">{customerDisplayName(j.customers ?? {})}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600">{formatDate(j.scheduled_start)}</p>
                    <span className={`badge ${statusColor(j.status)}`}>{j.status.replace("_", " ")}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold">Outstanding invoices</h2>
            <Link href="/invoices" className="text-sm text-brand-600 hover:underline">View all</Link>
          </header>
          {!openInvoices?.length ? (
            <p className="p-6 text-sm text-gray-500">All invoices paid 🎉</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {openInvoices.map((i: any) => (
                <li key={i.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/invoices/${i.id}`} className="font-medium text-gray-900 truncate block hover:text-brand-700">{i.invoice_number}</Link>
                    <p className="text-xs text-gray-500 truncate">{customerDisplayName(i.customers ?? {})}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(Number(i.balance_due))}</p>
                    <span className={`badge ${statusColor(i.status)}`}>{i.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold">Follow up — estimates sent ≥ 3 days ago</h2>
            <Link href="/estimates" className="text-sm text-brand-600 hover:underline">View all</Link>
          </header>
          {!followUpEstimates?.length ? (
            <p className="p-6 text-sm text-gray-500">Nothing needs follow-up.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {followUpEstimates.map((e: any) => (
                <li key={e.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/estimates/${e.id}`} className="font-medium hover:text-brand-700">{e.estimate_number}</Link>
                    <p className="text-xs text-gray-500 truncate">{customerDisplayName(e.customers ?? {})}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(Number(e.total))}</p>
                    <p className="text-xs text-gray-500">Sent {formatDate(e.sent_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold">Recent leads</h2>
            <Link href="/leads" className="text-sm text-brand-600 hover:underline">View all</Link>
          </header>
          {!recentLeads?.length ? (
            <p className="p-6 text-sm text-gray-500">No leads yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentLeads.map((l) => (
                <li key={l.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{[l.first_name, l.last_name].filter(Boolean).join(" ") || "Anonymous"}</p>
                    <p className="text-xs text-gray-500">{l.phone || "—"}</p>
                  </div>
                  <div className="text-right">
                    {l.estimated_value && <p className="text-sm font-medium">{formatCurrency(Number(l.estimated_value))}</p>}
                    <span className={`badge ${statusColor(l.status)}`}>{l.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold">Low stock alerts</h2>
            <Link href="/chemicals" className="text-sm text-brand-600 hover:underline">View all</Link>
          </header>
          {!lowStockItems.length ? (
            <p className="p-6 text-sm text-gray-500">All chemicals stocked above reorder level.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {lowStockItems.map((c) => (
                <li key={c.id} className="px-4 py-3 flex items-center justify-between">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-red-600">{c.current_stock} / {c.reorder_level} {c.unit}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold">Equipment service due (14 days)</h2>
            <Link href="/equipment" className="text-sm text-brand-600 hover:underline">View all</Link>
          </header>
          {!serviceDueEquip?.length ? (
            <p className="p-6 text-sm text-gray-500">No upcoming services.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {serviceDueEquip.map((e) => (
                <li key={e.id} className="px-4 py-3 flex items-center justify-between">
                  <p className="font-medium">{e.name}</p>
                  <p className="text-sm text-amber-700">{formatDate(e.next_service_date)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  return (
    <div className="card-padded">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold mt-1 ${tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-green-700" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function ActionStat({ label, count, href, tone }: { label: string; count: number; href: string; tone?: "ok" | "warn" | "alert" }) {
  return (
    <Link href={href} className={`card-padded flex flex-col items-start hover:bg-gray-50 transition ${tone === "alert" ? "border-red-300 ring-1 ring-red-100" : tone === "warn" ? "border-amber-300" : ""}`}>
      <p className={`text-2xl font-bold ${tone === "alert" ? "text-red-700" : tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-green-700" : ""}`}>{count}</p>
      <p className="text-xs text-gray-600 mt-0.5">{label}</p>
    </Link>
  );
}
