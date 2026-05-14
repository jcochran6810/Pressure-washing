import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { deleteExpense } from "./actions";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Search = {
  period?: string;
  category?: string;
  q?: string;
  deductible?: string;
  from?: string;
  to?: string;
};

function rangeFor(period: string | undefined): { start: Date; end: Date; label: string } {
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  if (period === "this_month" || !period) {
    start.setDate(1);
    return { start, end, label: "This month" };
  }
  if (period === "last_month") {
    start.setMonth(start.getMonth() - 1, 1);
    end.setDate(0); end.setHours(23, 59, 59, 999);
    return { start, end, label: "Last month" };
  }
  if (period === "quarter") {
    const q = Math.floor(start.getMonth() / 3);
    start.setMonth(q * 3, 1);
    return { start, end, label: "This quarter" };
  }
  if (period === "ytd") {
    start.setMonth(0, 1);
    return { start, end, label: "Year to date" };
  }
  if (period === "year") {
    start.setFullYear(start.getFullYear() - 1);
    return { start, end, label: "Last 12 months" };
  }
  if (period === "all") {
    start.setFullYear(2000, 0, 1);
    return { start, end, label: "All time" };
  }
  start.setDate(1);
  return { start, end, label: "This month" };
}

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const sp = await searchParams;

  // Resolve date range (custom from/to overrides period chip)
  let start: Date, end: Date, label: string;
  if (sp.from || sp.to) {
    start = sp.from ? new Date(sp.from) : new Date("2000-01-01");
    end = sp.to ? new Date(sp.to) : new Date();
    end.setHours(23, 59, 59, 999);
    label = "Custom range";
  } else {
    ({ start, end, label } = rangeFor(sp.period));
  }
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  // Build the filtered query
  let q = supabase
    .from("expenses")
    .select("*, expense_categories(id, name)")
    .eq("organization_id", organizationId)
    .gte("expense_date", startStr)
    .lte("expense_date", endStr)
    .order("expense_date", { ascending: false });

  if (sp.category) q = q.eq("category_id", sp.category);
  if (sp.deductible === "on") q = q.eq("tax_deductible", true);
  if (sp.q) q = q.or(`vendor.ilike.%${sp.q}%,description.ilike.%${sp.q}%`);

  const [{ data: expenses }, { data: categories }, { data: trendRows }] = await Promise.all([
    q,
    supabase.from("expense_categories").select("id, name").eq("organization_id", organizationId).order("name"),
    // 12-month trend (independent of the filter)
    supabase
      .from("expenses")
      .select("amount, expense_date")
      .eq("organization_id", organizationId)
      .gte("expense_date", monthsAgoStr(11)),
  ]);

  // Aggregates over filtered set
  const total = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const deductibleTotal = (expenses ?? []).filter((e: any) => e.tax_deductible).reduce((s, e: any) => s + Number(e.amount), 0);
  const withReceipt = (expenses ?? []).filter((e: any) => !!e.receipt_url).length;
  const avg = expenses?.length ? total / expenses.length : 0;

  // By category
  const byCategory = new Map<string, { id: string | null; name: string; total: number; count: number }>();
  (expenses ?? []).forEach((e: any) => {
    const id = e.expense_categories?.id ?? null;
    const name = e.expense_categories?.name ?? "Uncategorized";
    const key = id ?? "null";
    const cur = byCategory.get(key) ?? { id, name, total: 0, count: 0 };
    cur.total += Number(e.amount);
    cur.count += 1;
    byCategory.set(key, cur);
  });
  const categoryList = Array.from(byCategory.values()).sort((a, b) => b.total - a.total);
  const maxCat = categoryList[0]?.total ?? 1;

  // Top vendors
  const byVendor = new Map<string, number>();
  (expenses ?? []).forEach((e: any) => {
    const v = e.vendor || "Unknown";
    byVendor.set(v, (byVendor.get(v) ?? 0) + Number(e.amount));
  });
  const topVendors = Array.from(byVendor.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // Monthly trend (last 12 months)
  const months = buildMonths(12);
  (trendRows ?? []).forEach((e: any) => {
    const key = e.expense_date?.slice(0, 7);
    const m = months.find((x) => x.key === key);
    if (m) m.total += Number(e.amount ?? 0);
  });
  const maxMonth = Math.max(1, ...months.map((m) => m.total));

  const periodChips: { value: string; label: string }[] = [
    { value: "this_month", label: "This month" },
    { value: "last_month", label: "Last month" },
    { value: "quarter", label: "Quarter" },
    { value: "ytd", label: "YTD" },
    { value: "year", label: "12 mo" },
    { value: "all", label: "All time" },
  ];
  const activePeriod = sp.period ?? "this_month";

  function chipHref(value: string) {
    const params = new URLSearchParams();
    params.set("period", value);
    if (sp.category) params.set("category", sp.category);
    if (sp.q) params.set("q", sp.q);
    if (sp.deductible) params.set("deductible", sp.deductible);
    return `/expenses?${params.toString()}`;
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Every dollar going out — fuel, chemicals, insurance, payroll."
        action={{ label: "New expense", href: "/expenses/new" }}
      />

      {/* Filters */}
      <div className="card-padded mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {periodChips.map((c) => (
            <Link
              key={c.value}
              href={chipHref(c.value)}
              className={`px-3 py-1.5 rounded-full text-sm ${
                activePeriod === c.value && !sp.from && !sp.to
                  ? "bg-brand-600 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {c.label}
            </Link>
          ))}
        </div>

        <form className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
          <input type="hidden" name="period" value={sp.period ?? ""} />
          <div>
            <label className="text-xs">From</label>
            <input type="date" name="from" defaultValue={sp.from ?? ""} className="w-full" />
          </div>
          <div>
            <label className="text-xs">To</label>
            <input type="date" name="to" defaultValue={sp.to ?? ""} className="w-full" />
          </div>
          <div>
            <label className="text-xs">Category</label>
            <select name="category" defaultValue={sp.category ?? ""} className="w-full">
              <option value="">All categories</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs">Search</label>
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Vendor or description" className="w-full" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs flex items-center gap-1.5">
              <input type="checkbox" name="deductible" defaultChecked={sp.deductible === "on"} />
              <span>Deductible only</span>
            </label>
            <button className="btn-secondary text-sm">Apply</button>
          </div>
        </form>
      </div>

      {/* KPIs (filtered) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label={label} value={formatCurrency(total)} sub={`${expenses?.length ?? 0} expenses`} />
        <Stat label="Avg / expense" value={formatCurrency(avg)} />
        <Stat label="Deductible" value={formatCurrency(deductibleTotal)} sub={`${total > 0 ? Math.round((deductibleTotal / total) * 100) : 0}% of total`} />
        <Stat label="Receipts saved" value={`${withReceipt}/${expenses?.length ?? 0}`} sub="photos / files attached" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <section className="card">
          <header className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold">By category</h2>
            <span className="text-xs text-gray-500">{label}</span>
          </header>
          {!categoryList.length ? (
            <p className="p-4 text-sm text-gray-500">No expenses in this range.</p>
          ) : (
            <ul className="px-4 py-3 space-y-2">
              {categoryList.map((c) => (
                <li key={c.name}>
                  <div className="flex justify-between text-xs mb-1">
                    {c.id ? (
                      <Link
                        href={chipHref(activePeriod).replace(/category=[^&]*/, "") + `&category=${c.id}`}
                        className="font-medium text-gray-800 hover:text-brand-700"
                      >
                        {c.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-gray-800">{c.name}</span>
                    )}
                    <span className="tabular-nums">{formatCurrency(c.total)} <span className="text-gray-400">· {c.count}</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <header className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold">Monthly trend</h2>
            <span className="text-xs text-gray-500">Last 12 months (all categories)</span>
          </header>
          <div className="px-4 pt-4 pb-3 grid grid-cols-12 gap-1">
            {months.map((m) => (
              <div key={m.key} className="flex flex-col items-center">
                <div className="flex items-end h-28 w-full justify-center">
                  <div
                    className="w-full bg-brand-500 rounded-t"
                    style={{ height: `${(m.total / maxMonth) * 100}%` }}
                    title={`${m.label}: ${formatCurrency(m.total)}`}
                  />
                </div>
                <p className="text-[10px] mt-1 text-gray-500">{m.short}</p>
              </div>
            ))}
          </div>
          <div className="px-4 pb-3 text-xs text-gray-500 flex flex-wrap justify-between">
            <span>Total: {formatCurrency(months.reduce((s, m) => s + m.total, 0))}</span>
            <span>Avg: {formatCurrency(months.reduce((s, m) => s + m.total, 0) / 12)} / mo</span>
          </div>
        </section>
      </div>

      {/* Top vendors */}
      {!!topVendors.length && (
        <section className="card mb-5">
          <header className="px-4 py-3 border-b">
            <h2 className="font-semibold">Top vendors</h2>
          </header>
          <ul className="divide-y divide-gray-100">
            {topVendors.map((v) => (
              <li key={v.name} className="px-4 py-2 flex justify-between text-sm">
                <span className="truncate">{v.name}</span>
                <span className="font-medium tabular-nums">{formatCurrency(v.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Expenses table — one line each */}
      {!expenses?.length ? (
        <EmptyState title="No expenses match these filters" action={{ label: "New expense", href: "/expenses/new" }} />
      ) : (
        <div className="table-wrap overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Vendor</th>
                <th>Category</th>
                <th className="hidden sm:table-cell">Description</th>
                <th className="text-center">Receipt</th>
                <th className="text-right">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e: any) => {
                const del = deleteExpense.bind(null, e.id);
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap">{formatDate(e.expense_date)}</td>
                    <td className="font-medium">{e.vendor || "—"}</td>
                    <td>{e.expense_categories?.name || "Uncategorized"}</td>
                    <td className="hidden sm:table-cell text-gray-500 max-w-xs truncate">{e.description || ""}</td>
                    <td className="text-center">
                      {e.receipt_url ? (
                        <a href={e.receipt_url} target="_blank" rel="noopener" className="text-brand-600 hover:underline" title="View receipt">📎</a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="text-right font-medium tabular-nums">{formatCurrency(Number(e.amount))}</td>
                    <td>
                      <form action={del}><button className="text-xs text-red-600 hover:underline">✕</button></form>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={5} className="text-right">Total ({expenses.length} expenses)</td>
                <td className="text-right tabular-nums">{formatCurrency(total)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card-padded">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-xl sm:text-2xl font-bold mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function monthsAgoStr(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function buildMonths(n: number) {
  const out: { key: string; label: string; short: string; total: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - i);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-US", { month: "long", year: "numeric" }),
      short: d.toLocaleString("en-US", { month: "short" }),
      total: 0,
    });
  }
  return out;
}
