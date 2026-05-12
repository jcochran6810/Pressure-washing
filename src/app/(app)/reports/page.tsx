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

  const [{ data: payments }, { data: expenses }, { data: categories }, { data: outstanding }, { data: monthlySeries }] = await Promise.all([
    supabase.from("payments").select("amount, payment_date, payment_method, customer_id").eq("organization_id", organizationId).gte("payment_date", startStr).lte("payment_date", endStr),
    supabase.from("expenses").select("amount, expense_date, vendor, category_id, tax_deductible, expense_categories(name)").eq("organization_id", organizationId).gte("expense_date", startStr).lte("expense_date", endStr),
    supabase.from("expense_categories").select("*").eq("organization_id", organizationId),
    supabase.from("invoices").select("balance_due, due_date, status").eq("organization_id", organizationId).in("status", ["sent", "partial", "overdue"]),
    // For trend: last 6 months payments + expenses
    supabase.rpc as any, // placeholder removed below
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
          <Link href="/reports/tax-export" className="btn-primary">📋 Tax export (Schedule C)</Link>
          <Link href="/expenses/new" className="btn-secondary">+ Log expense</Link>
          <Link href="/invoices/new" className="btn-secondary">+ New invoice</Link>
          <Link href="/payments" className="btn-secondary">View payments</Link>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Tax export bundles all income, expenses (auto-mapped to Schedule C lines), chemical-usage COGS, and
          equipment depreciation for the year — printable on screen or downloadable as a CSV your CPA can paste
          straight into their software.
        </p>
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
