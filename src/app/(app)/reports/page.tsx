import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function rangeFor(period: string) {
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const start = new Date();
  if (period === "ytd") { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
  else if (period === "quarter") {
    const q = Math.floor(start.getMonth() / 3);
    start.setMonth(q * 3, 1); start.setHours(0, 0, 0, 0);
  } else if (period === "last_month") {
    start.setMonth(start.getMonth() - 1, 1); start.setHours(0, 0, 0, 0);
    end.setDate(0); end.setHours(23, 59, 59, 999);
  } else if (period === "year") {
    start.setFullYear(start.getFullYear() - 1, start.getMonth(), start.getDate());
  } else { // month (default)
    start.setDate(1); start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { period } = await searchParams;
  const sel = period || "month";
  const { start, end } = rangeFor(sel);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const [
    { data: payments },
    { data: expenses },
    { data: outstanding },
    { data: estimatesInPeriod },
    { data: jobsCompletedInPeriod },
    { data: leadsInPeriod },
    { data: recurringActive },
    { data: estimateLineItems },
    { data: completedJobsAllTime },
    { data: topCustomerPayments },
  ] = await Promise.all([
    supabase.from("payments").select("amount, payment_date, payment_method, customer_id").eq("organization_id", organizationId).gte("payment_date", startStr).lte("payment_date", endStr),
    supabase.from("expenses").select("amount, expense_date, vendor, category_id, tax_deductible, expense_categories(name)").eq("organization_id", organizationId).gte("expense_date", startStr).lte("expense_date", endStr),
    supabase.from("invoices").select("balance_due, due_date, status").eq("organization_id", organizationId).in("status", ["sent", "partial", "overdue"]),
    supabase.from("estimates").select("status, total").eq("organization_id", organizationId).gte("issue_date", startStr).lte("issue_date", endStr),
    supabase.from("jobs").select("total_amount, actual_end").eq("organization_id", organizationId).eq("status", "completed").gte("actual_end", start.toISOString()).lte("actual_end", end.toISOString()),
    supabase.from("leads").select("source_id, status, lead_sources(name)").eq("organization_id", organizationId).gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
    (supabase as any).from("recurring_jobs").select("default_price, recurrence_kind, recurrence_interval").eq("organization_id", organizationId).eq("active", true),
    supabase.from("estimate_line_items").select("description, total, service_id, estimates!inner(organization_id, issue_date, status)").eq("estimates.organization_id", organizationId).gte("estimates.issue_date", startStr).lte("estimates.issue_date", endStr),
    // Service performance (all-time) — completed jobs with actual_start/end, joined to their estimate's line items so we can attribute duration to services.
    supabase
      .from("jobs")
      .select("id, actual_start, actual_end, total_amount, estimate_id, estimates(estimate_line_items(service_id, description))")
      .eq("organization_id", organizationId)
      .eq("status", "completed")
      .not("actual_start", "is", null)
      .not("actual_end", "is", null)
      .limit(500),
    // Top customers by lifetime payment total.
    supabase
      .from("payments")
      .select("amount, customer_id, customers(first_name, last_name, company_name)")
      .eq("organization_id", organizationId)
      .limit(1000),
  ]);

  // Trend: pull last 6 months payments and expenses separately
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5); sixMonthsAgo.setDate(1); sixMonthsAgo.setHours(0, 0, 0, 0);
  const [{ data: paymentsAll }, { data: expensesAll }] = await Promise.all([
    supabase.from("payments").select("amount, payment_date").eq("organization_id", organizationId).gte("payment_date", sixMonthsAgo.toISOString().slice(0, 10)),
    supabase.from("expenses").select("amount, expense_date").eq("organization_id", organizationId).gte("expense_date", sixMonthsAgo.toISOString().slice(0, 10)),
  ]);

  const revenue = (payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalExpense = (expenses ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const deductibleExpense = (expenses ?? []).filter((e) => e.tax_deductible).reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const net = revenue - totalExpense;
  const margin = revenue > 0 ? (net / revenue) * 100 : 0;
  const outstandingTotal = (outstanding ?? []).reduce((s, i) => s + Number(i.balance_due ?? 0), 0);

  // Expenses by category
  const byCategory = new Map<string, { name: string; total: number }>();
  (expenses ?? []).forEach((e: any) => {
    const name = e.expense_categories?.name || "Uncategorized";
    const cur = byCategory.get(name) ?? { name, total: 0 };
    cur.total += Number(e.amount);
    byCategory.set(name, cur);
  });
  const categoryList = Array.from(byCategory.values()).sort((a, b) => b.total - a.total);

  // Top vendors
  const byVendor = new Map<string, number>();
  (expenses ?? []).forEach((e: any) => {
    const v = e.vendor || "Unknown";
    byVendor.set(v, (byVendor.get(v) ?? 0) + Number(e.amount));
  });
  const vendors = Array.from(byVendor.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 8);

  // Payment method mix
  const byMethod = new Map<string, number>();
  (payments ?? []).forEach((p: any) => {
    byMethod.set(p.payment_method || "other", (byMethod.get(p.payment_method || "other") ?? 0) + Number(p.amount));
  });

  // Monthly trend
  const months: { key: string; label: string; revenue: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: d.toLocaleString("en-US", { month: "short" }), revenue: 0, expense: 0 });
  }
  (paymentsAll ?? []).forEach((p: any) => {
    const key = p.payment_date?.slice(0, 7);
    const m = months.find((x) => x.key === key);
    if (m) m.revenue += Number(p.amount ?? 0);
  });
  (expensesAll ?? []).forEach((e: any) => {
    const key = e.expense_date?.slice(0, 7);
    const m = months.find((x) => x.key === key);
    if (m) m.expense += Number(e.amount ?? 0);
  });
  const maxBar = Math.max(1, ...months.flatMap((m) => [m.revenue, m.expense]));

  // ---- Operational metrics ----

  // Estimate win rate: accepted+converted divided by (accepted+converted+declined+expired)
  const estStatuses = (estimatesInPeriod ?? []).map((e: any) => e.status);
  const wonCount = estStatuses.filter((s: string) => s === "accepted" || s === "converted").length;
  const lostCount = estStatuses.filter((s: string) => s === "declined" || s === "expired").length;
  const decidedCount = wonCount + lostCount;
  const winRate = decidedCount > 0 ? (wonCount / decidedCount) * 100 : null;

  // Average job value (completed jobs in period)
  const completedTotals = (jobsCompletedInPeriod ?? []).map((j: any) => Number(j.total_amount ?? 0));
  const completedCount = completedTotals.length;
  const avgJobValue = completedCount > 0 ? completedTotals.reduce((s, n) => s + n, 0) / completedCount : 0;

  // Lead sources (top 5)
  const sourceMap = new Map<string, { name: string; total: number; won: number }>();
  for (const l of (leadsInPeriod ?? []) as any[]) {
    const name = l.lead_sources?.name || "Unknown";
    const cur = sourceMap.get(name) ?? { name, total: 0, won: 0 };
    cur.total += 1;
    if (l.status === "won") cur.won += 1;
    sourceMap.set(name, cur);
  }
  const topSources = Array.from(sourceMap.values()).sort((a, b) => b.total - a.total).slice(0, 5);

  // Recurring monthly revenue (rough — annualised then /12 per template)
  function approximateMonthlyRevenue(r: any): number {
    const price = Number(r.default_price ?? 0);
    const interval = Math.max(1, Number(r.recurrence_interval ?? 1));
    const visitsPerMonth = (() => {
      switch (r.recurrence_kind) {
        case "daily": return 30 / interval;
        case "weekly": return 4.33 / interval;
        case "biweekly": return 2.17;
        case "triweekly": return 1.45;
        case "monthly": return 1 / interval;
        case "quarterly": return 1 / 3;
        case "seasonal": return 1 / 3;
        case "semiannual": return 1 / 6;
        case "annual": return 1 / 12;
        case "custom_days": return 30 / interval;
        default: return 0;
      }
    })();
    return price * visitsPerMonth;
  }
  const recurringMRR = (recurringActive ?? []).reduce((s: number, r: any) => s + approximateMonthlyRevenue(r), 0);

  // Top services by line-item revenue. Falls back to description when service_id is null.
  const serviceMap = new Map<string, number>();
  for (const li of (estimateLineItems ?? []) as any[]) {
    const key = li.description || "Unnamed";
    serviceMap.set(key, (serviceMap.get(key) ?? 0) + Number(li.total ?? 0));
  }
  const topServices = Array.from(serviceMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const topServiceMax = topServices[0]?.total ?? 1;

  // Service performance — average actual duration per service across completed
  // jobs. Use this to refine future estimates: "House Wash averages 2h 15m".
  type ServicePerf = { name: string; count: number; totalMinutes: number; totalRevenue: number };
  const perfMap = new Map<string, ServicePerf>();
  for (const j of (completedJobsAllTime ?? []) as any[]) {
    const start = j.actual_start ? new Date(j.actual_start).getTime() : null;
    const end = j.actual_end ? new Date(j.actual_end).getTime() : null;
    if (!start || !end || end <= start) continue;
    const mins = (end - start) / 60000;
    const items: any[] = j.estimates?.estimate_line_items ?? [];
    if (!items.length) continue;
    // Attribute the job's duration + revenue equally across its line items
    const share = 1 / items.length;
    for (const li of items) {
      const name = (li.description as string) || "Unnamed";
      const cur = perfMap.get(name) ?? { name, count: 0, totalMinutes: 0, totalRevenue: 0 };
      cur.count += share;
      cur.totalMinutes += mins * share;
      cur.totalRevenue += Number(j.total_amount ?? 0) * share;
      perfMap.set(name, cur);
    }
  }
  const servicePerf = Array.from(perfMap.values())
    .filter((p) => p.count >= 0.5)
    .map((p) => ({
      name: p.name,
      jobs: Math.round(p.count),
      avgMinutes: p.totalMinutes / Math.max(1, p.count),
      avgRevenue: p.totalRevenue / Math.max(1, p.count),
    }))
    .sort((a, b) => b.jobs - a.jobs)
    .slice(0, 8);

  function fmtDuration(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // Top customers — lifetime spend (paid payments).
  const customerMap = new Map<string, { name: string; total: number }>();
  for (const p of (topCustomerPayments ?? []) as any[]) {
    if (!p.customer_id) continue;
    const c = p.customers ?? {};
    const name = c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Customer";
    const cur = customerMap.get(p.customer_id) ?? { name, total: 0 };
    cur.total += Number(p.amount ?? 0);
    customerMap.set(p.customer_id, cur);
  }
  const topCustomers = Array.from(customerMap.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const topCustomerMax = topCustomers[0]?.total ?? 1;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Accounting</h1>
          <p className="text-sm text-gray-600">P&amp;L, categories, vendors. Built from your payments and expenses.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[["month", "This month"], ["last_month", "Last month"], ["quarter", "This quarter"], ["ytd", "Year to date"], ["year", "Last 12 months"]].map(([k, label]) => (
            <Link key={k} href={`/reports?period=${k}`} className={`px-3 py-1.5 rounded-full text-sm ${sel === k ? "bg-brand-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}>{label}</Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Kpi label="Revenue" value={formatCurrency(revenue)} />
        <Kpi label="Expenses" value={formatCurrency(totalExpense)} tone="warn" />
        <Kpi label="Net profit" value={formatCurrency(net)} tone={net >= 0 ? "ok" : "warn"} sub={`${margin.toFixed(1)}% margin`} />
        <Kpi label="Outstanding AR" value={formatCurrency(outstandingTotal)} sub={`${outstanding?.length ?? 0} invoices`} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Kpi
          label="Estimate win rate"
          value={winRate == null ? "—" : `${winRate.toFixed(0)}%`}
          sub={`${wonCount} won / ${decidedCount} decided`}
          tone={winRate != null && winRate >= 50 ? "ok" : winRate != null ? "warn" : undefined}
        />
        <Kpi label="Jobs completed" value={String(completedCount)} sub={`avg ${formatCurrency(avgJobValue)}`} />
        <Kpi label="Recurring MRR" value={formatCurrency(recurringMRR)} sub={`${recurringActive?.length ?? 0} active templates`} />
        <Kpi
          label="New leads"
          value={String(leadsInPeriod?.length ?? 0)}
          sub={topSources[0] ? `top: ${topSources[0].name}` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-5">
        <section className="card">
          <header className="px-4 py-3 border-b">
            <h2 className="font-semibold">Top services</h2>
            <p className="text-xs text-gray-500">Estimate line-item revenue in this period.</p>
          </header>
          {!topServices.length ? (
            <p className="p-4 text-sm text-gray-500">No estimates in this period yet.</p>
          ) : (
            <ul className="px-4 py-3 space-y-2">
              {topServices.map((s) => (
                <li key={s.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-800 truncate pr-2">{s.name}</span>
                    <span className="tabular-nums">{formatCurrency(s.total)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500" style={{ width: `${(s.total / topServiceMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="px-4 py-3 border-b">
            <h2 className="font-semibold">Best lead sources</h2>
            <p className="text-xs text-gray-500">Leads created in this period, by source.</p>
          </header>
          {!topSources.length ? (
            <p className="p-4 text-sm text-gray-500">No leads in this period yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {topSources.map((s) => {
                const conv = s.total > 0 ? Math.round((s.won / s.total) * 100) : 0;
                return (
                  <li key={s.name} className="px-4 py-2 flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="text-xs text-gray-600">
                      {s.total} lead{s.total === 1 ? "" : "s"} · {conv}% won
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-5">
        <section className="card">
          <header className="px-4 py-3 border-b">
            <h2 className="font-semibold">Service performance</h2>
            <p className="text-xs text-gray-500">Average actual duration across completed jobs — use to refine future estimates.</p>
          </header>
          {!servicePerf.length ? (
            <p className="p-4 text-sm text-gray-500">No completed jobs with recorded start/end times yet. Time data starts collecting once jobs are marked in-progress / completed.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {servicePerf.map((s) => (
                <li key={s.name} className="px-4 py-2 text-sm">
                  <div className="flex justify-between items-baseline">
                    <span className="font-medium text-gray-800 truncate pr-2">{s.name}</span>
                    <span className="text-xs text-gray-500">{s.jobs} job{s.jobs === 1 ? "" : "s"}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                    <span>avg duration <strong className="text-gray-700">{fmtDuration(s.avgMinutes)}</strong></span>
                    <span>avg revenue <strong className="text-gray-700">{formatCurrency(s.avgRevenue)}</strong></span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="px-4 py-3 border-b">
            <h2 className="font-semibold">Top customers</h2>
            <p className="text-xs text-gray-500">Lifetime payments. Your most valuable accounts.</p>
          </header>
          {!topCustomers.length ? (
            <p className="p-4 text-sm text-gray-500">No payments recorded yet.</p>
          ) : (
            <ul className="px-4 py-3 space-y-2">
              {topCustomers.map((c) => (
                <li key={c.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <Link href={`/customers/${c.id}`} className="font-medium text-gray-800 hover:text-brand-700 truncate pr-2">{c.name}</Link>
                    <span className="tabular-nums">{formatCurrency(c.total)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500" style={{ width: `${(c.total / topCustomerMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="card mb-5">
        <header className="px-4 py-3 border-b">
          <h2 className="font-semibold">Revenue vs Expenses (last 6 months)</h2>
        </header>
        <div className="px-4 pt-4 pb-3 grid grid-cols-6 gap-3">
          {months.map((m) => (
            <div key={m.key} className="text-center">
              <div className="flex items-end justify-center gap-1 h-32">
                <div className="w-3 bg-brand-500 rounded-t" style={{ height: `${(m.revenue / maxBar) * 100}%` }} title={`Revenue: ${formatCurrency(m.revenue)}`} />
                <div className="w-3 bg-red-400 rounded-t" style={{ height: `${(m.expense / maxBar) * 100}%` }} title={`Expense: ${formatCurrency(m.expense)}`} />
              </div>
              <p className="text-xs mt-1 text-gray-600">{m.label}</p>
              <p className="text-xs text-brand-600">{formatCurrency(m.revenue)}</p>
              <p className="text-xs text-red-500">− {formatCurrency(m.expense)}</p>
            </div>
          ))}
        </div>
        <div className="px-4 pb-3 text-xs text-gray-500 flex gap-4">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-brand-500 rounded-sm"/> Revenue</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-sm"/> Expenses</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mb-5">
        <section className="card lg:col-span-2">
          <header className="px-4 py-3 border-b">
            <h2 className="font-semibold">P&amp;L statement</h2>
            <p className="text-xs text-gray-500">{formatDate(start)} → {formatDate(end)}</p>
          </header>
          <div className="px-4 py-3 text-sm">
            <Line label="Revenue" value={formatCurrency(revenue)} bold />
            <div className="ml-3 my-2 space-y-1">
              {Array.from(byMethod.entries()).map(([m, v]) => <Line key={m} label={`Payments via ${m}`} value={formatCurrency(v)} muted />)}
            </div>
            <Line label="Expenses" value={formatCurrency(totalExpense)} bold />
            <div className="ml-3 my-2 space-y-1">
              {categoryList.map((c) => <Line key={c.name} label={c.name} value={`− ${formatCurrency(c.total)}`} muted />)}
            </div>
            <div className="border-t border-gray-200 my-2" />
            <Line label="Net profit" value={formatCurrency(net)} bold large color={net >= 0 ? "text-green-700" : "text-red-700"} />
            <p className="text-xs text-gray-500 mt-2">Tax-deductible expenses in period: {formatCurrency(deductibleExpense)}</p>
          </div>
        </section>

        <section className="card">
          <header className="px-4 py-3 border-b">
            <h2 className="font-semibold">Top vendors</h2>
          </header>
          {!vendors.length ? <p className="p-4 text-sm text-gray-500">No expenses in this period.</p> : (
            <ul className="divide-y divide-gray-100">
              {vendors.map((v) => (
                <li key={v.name} className="px-4 py-2 flex justify-between text-sm">
                  <span className="truncate">{v.name}</span>
                  <span className="font-medium">{formatCurrency(v.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="card-padded">
        <h3 className="font-semibold mb-1">Quick actions</h3>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/expenses/new" className="btn-secondary">+ Log expense</Link>
          <Link href="/invoices/new" className="btn-secondary">+ New invoice</Link>
          <Link href="/payments" className="btn-secondary">View payments</Link>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" }) {
  return (
    <div className="card-padded">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold mt-1 ${tone === "ok" ? "text-green-700" : tone === "warn" ? "text-amber-600" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function Line({ label, value, bold, muted, large, color }: { label: string; value: string; bold?: boolean; muted?: boolean; large?: boolean; color?: string }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""} ${muted ? "text-gray-500" : ""} ${large ? "text-lg" : ""} ${color ?? ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
