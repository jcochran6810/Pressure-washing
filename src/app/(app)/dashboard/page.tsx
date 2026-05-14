import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { formatCurrency, formatDate, customerDisplayName, statusColor } from "@/lib/utils";
import { DashboardHub } from "@/components/dashboard-hub";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { supabase, organizationId } = await getSessionAndOrg();

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  const followUpCutoff = new Date(); followUpCutoff.setDate(followUpCutoff.getDate() - 3);

  const [
    { count: unpaidCount },
    { count: overdueCount },
    { count: draftCount },
    { count: newLeadCount },
    { count: customerCount },
    { count: servicesCount },
    { count: openFollowUpsCount },
    { data: openInvoices },
    { data: upcomingJobs },
    { data: todayJobs },
    { data: recentLeads },
    { data: monthPayments },
    { data: monthExpenses },
    { data: lowStock },
    { data: followUpEstimates },
  ] = await Promise.all([
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["sent", "partial", "overdue"]),
    supabase.from("invoices").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "overdue"),
    supabase.from("estimates").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "draft"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "new"),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("services").select("*", { count: "exact", head: true }).eq("organization_id", organizationId),
    (supabase as any).from("follow_ups").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("completed", false),
    supabase.from("invoices").select("id, invoice_number, total, balance_due, status, due_date, customers(first_name, last_name, company_name)").eq("organization_id", organizationId).in("status", ["sent", "partial", "overdue"]).order("due_date", { ascending: true }).limit(5),
    supabase.from("jobs").select("id, title, scheduled_start, status, total_amount, customers(first_name, last_name, company_name)").eq("organization_id", organizationId).gte("scheduled_start", new Date().toISOString()).lte("scheduled_start", weekEnd.toISOString()).order("scheduled_start", { ascending: true }).limit(8),
    supabase
      .from("jobs")
      .select("id, title, scheduled_start, scheduled_end, status, customers(first_name, last_name, company_name, phone, mobile_phone, email), properties(address_line1, city, state, latitude, longitude)")
      .eq("organization_id", organizationId)
      .gte("scheduled_start", todayStart.toISOString())
      .lt("scheduled_start", tomorrowStart.toISOString())
      .order("scheduled_start"),
    supabase.from("leads").select("id, first_name, last_name, phone, status, created_at, estimated_value").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(5),
    supabase.from("payments").select("amount").eq("organization_id", organizationId).gte("payment_date", monthStart.toISOString().slice(0, 10)),
    supabase.from("expenses").select("amount").eq("organization_id", organizationId).gte("expense_date", monthStart.toISOString().slice(0, 10)),
    supabase.from("chemicals").select("id, name, current_stock, reorder_level, unit").eq("organization_id", organizationId),
    supabase.from("estimates").select("id, estimate_number, status, total, sent_at, issue_date, customers(first_name, last_name, company_name)").eq("organization_id", organizationId).eq("status", "sent").lte("sent_at", followUpCutoff.toISOString()).order("sent_at").limit(5),
  ]);

  const revenueMTD = (monthPayments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const expenseMTD = (monthExpenses ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const profitMTD = revenueMTD - expenseMTD;
  const outstanding = (openInvoices ?? []).reduce((s, i) => s + Number(i.balance_due ?? 0), 0);
  const lowStockItems = (lowStock ?? []).filter((c) => (c.current_stock ?? 0) <= (c.reorder_level ?? 0));

  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const isFreshOrg =
    (customerCount ?? 0) === 0 &&
    (servicesCount ?? 0) === 0 &&
    !todayJobs?.length;

  return (
    <div id="overview">
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Today</h1>
        <p className="mt-1 text-sm text-gray-600">{dateLabel}</p>
      </div>

      {isFreshOrg && (
        <section className="card-padded mb-5 border-brand-200 bg-brand-50">
          <h2 className="font-semibold text-brand-800">Welcome — let's get you set up.</h2>
          <p className="text-xs text-brand-700 mt-1 mb-3">
            Three quick taps and you'll have a working catalog, your first customer, and an estimate ready to send.
          </p>
          <ol className="space-y-2 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span><strong>1.</strong> Pick your trade in Settings → Business type.</span>
              <Link href="/settings" className="btn-secondary text-xs whitespace-nowrap">Settings</Link>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span><strong>2.</strong> Load your trade's starter services + custom fields.</span>
              <Link href="/services" className="btn-secondary text-xs whitespace-nowrap">Services</Link>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span><strong>3.</strong> Add your first customer and send an estimate.</span>
              <Link href="/customers/new" className="btn-primary text-xs whitespace-nowrap">+ New customer</Link>
            </li>
          </ol>
        </section>
      )}

      {/* TODAY — what's on deck right now. Big touch targets for in-the-truck use. */}
      <section id="this-week" className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Today's jobs</h2>
          <Link href="/calendar" className="text-xs text-brand-600 hover:underline">Open calendar</Link>
        </div>
        {!todayJobs?.length ? (
          <div className="card-padded text-sm text-gray-500 flex items-center justify-between">
            <span>No jobs scheduled for today.</span>
            <Link href="/jobs/new" className="btn-secondary text-xs">+ Schedule one</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {todayJobs.map((j: any) => {
              const cust = j.customers ?? {};
              const prop = j.properties ?? null;
              const phone = (cust.phone || cust.mobile_phone || "").replace(/[^\d+]/g, "");
              const addr = prop ? [prop.address_line1, prop.city, prop.state].filter(Boolean).join(", ") : null;
              const mapsUrl = addr ? `https://maps.google.com/?q=${encodeURIComponent(addr)}` : null;
              const time = j.scheduled_start
                ? new Date(j.scheduled_start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                : "Anytime";
              return (
                <li key={j.id} className="card-padded">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <Link href={`/jobs/${j.id}`} className="font-semibold text-gray-900 hover:text-brand-700">
                        {j.title}
                      </Link>
                      <p className="text-sm text-gray-600">{customerDisplayName(cust)}</p>
                      {addr && <p className="text-xs text-gray-500 truncate">{addr}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{time}</p>
                      <span className={`badge ${statusColor(j.status)}`}>{j.status?.replace("_", " ")}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {phone && (
                      <a href={`tel:${phone}`} className="btn-secondary text-xs flex items-center gap-1">📞 Call</a>
                    )}
                    {phone && (
                      <a href={`sms:${phone}`} className="btn-secondary text-xs flex items-center gap-1">💬 Text</a>
                    )}
                    {mapsUrl && (
                      <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs flex items-center gap-1">🗺️ Map</a>
                    )}
                    <Link href={`/jobs/${j.id}`} className="btn-primary text-xs ml-auto">Open job →</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ALERTS — quick chips to redirect attention */}
      <div id="alerts" className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
        <ActionStat label="Unpaid invoices" count={unpaidCount ?? 0} href="/invoices?status=sent" tone={(unpaidCount ?? 0) > 0 ? "warn" : "ok"} />
        <ActionStat label="Overdue" count={overdueCount ?? 0} href="/invoices?status=overdue" tone={(overdueCount ?? 0) > 0 ? "alert" : "ok"} />
        <ActionStat label="Estimates to follow up" count={followUpEstimates?.length ?? 0} href="/estimates" tone={(followUpEstimates?.length ?? 0) > 0 ? "warn" : "ok"} />
        <ActionStat label="Draft estimates" count={draftCount ?? 0} href="/estimates" />
        <ActionStat label="New leads" count={newLeadCount ?? 0} href="/leads" tone={(newLeadCount ?? 0) > 0 ? "warn" : undefined} />
        <ActionStat label="Open follow-ups" count={openFollowUpsCount ?? 0} href="/follow-ups" tone={(openFollowUpsCount ?? 0) > 0 ? "warn" : "ok"} />
      </div>

      {/* Hub — six grouped tabs (mobile-first). Keeps deep navigation one tap away. */}
      <DashboardHub />

      <div className="mb-2 mt-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">At a glance</h2>
      </div>

      <div id="kpis" className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <KpiCard label="Revenue MTD" value={formatCurrency(revenueMTD)} tone="ok" />
        <KpiCard label="Expenses MTD" value={formatCurrency(expenseMTD)} />
        <KpiCard label="Profit MTD" value={formatCurrency(profitMTD)} tone={profitMTD >= 0 ? "ok" : "warn"} />
        <KpiCard label="A/R outstanding" value={formatCurrency(outstanding)} sub={`${unpaidCount ?? 0} unpaid`} tone={outstanding > 0 ? "warn" : undefined} />
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

        {!!lowStockItems.length && (
          <section className="card lg:col-span-2">
            <header className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold">Low stock alerts</h2>
              <Link href="/chemicals" className="text-sm text-brand-600 hover:underline">View all</Link>
            </header>
            <ul className="divide-y divide-gray-100">
              {lowStockItems.map((c: any) => (
                <li key={c.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-red-600 text-xs">
                    {c.current_stock ?? 0} / {c.reorder_level ?? 0} {c.unit}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  const valueColor = tone === "ok" ? "text-green-700" : tone === "warn" ? "text-amber-700" : "text-gray-900";
  return (
    <div className="card-padded">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold mt-0.5 ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function ActionStat({ label, count, href, tone }: { label: string; count: number; href: string; tone?: "ok" | "warn" | "alert" }) {
  const cls =
    tone === "alert"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "ok"
          ? "border-gray-200 bg-white text-gray-600"
          : "border-gray-200 bg-white text-gray-600";
  return (
    <Link href={href} className={`card-padded border ${cls} block`}>
      <p className="text-xs uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{count}</p>
    </Link>
  );
}
