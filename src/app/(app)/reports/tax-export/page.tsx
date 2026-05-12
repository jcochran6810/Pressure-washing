import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { formatCurrency, formatDate, customerDisplayName } from "@/lib/utils";
import {
  SCHEDULE_C_LINES,
  mapExpenseRowToScheduleC,
  type ScheduleCLine,
} from "@/lib/schedule-c";
import {
  computeDepreciation,
  totalYearDepreciation,
  type EquipmentRow,
} from "@/lib/depreciation";

export const dynamic = "force-dynamic";

type Search = { year?: string };

export default async function TaxExportPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year ?? now.getFullYear());
  const startStr = `${year}-01-01`;
  const endStr = `${year}-12-31`;
  const currency = organization?.currency ?? "USD";
  const fmt = (n: number) => formatCurrency(n, currency);

  const [
    { data: payments },
    { data: expenses },
    { data: equipment },
    { data: chemicalUsage },
    { data: invoiceLookup },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount, payment_date, payment_method, reference_number, customers(first_name, last_name, company_name), invoices(invoice_number, status)")
      .eq("organization_id", organizationId)
      .gte("payment_date", startStr)
      .lte("payment_date", endStr)
      .order("payment_date"),
    supabase
      .from("expenses")
      .select("id, amount, expense_date, vendor, description, payment_method, tax_deductible, receipt_url, expense_categories(name)")
      .eq("organization_id", organizationId)
      .gte("expense_date", startStr)
      .lte("expense_date", endStr)
      .order("expense_date"),
    supabase
      .from("equipment")
      .select("*")
      .eq("organization_id", organizationId)
      .order("purchase_date", { ascending: true }),
    // chemical usage in year — for cost of goods sold estimate
    supabase
      .from("chemical_transactions")
      .select("quantity, cost, transaction_type, transaction_date, chemicals(name, cost_per_unit)")
      .eq("organization_id", organizationId)
      .gte("transaction_date", startStr)
      .lte("transaction_date", endStr)
      .eq("transaction_type", "usage"),
    // not used directly, just here to surface invoice numbers on payments
    Promise.resolve({ data: null }),
  ]);

  // --- Part I: Income ---
  const grossReceipts = (payments ?? []).reduce((s, p: any) => s + Number(p.amount ?? 0), 0);

  // --- Part III: Cost of Goods Sold (chemicals consumed) ---
  // Sum the cost-per-unit × quantity for "usage" transactions. If a usage row
  // has its own cost stored we use that, otherwise fall back to the chemical's
  // cost_per_unit.
  const cogs = (chemicalUsage ?? []).reduce((s, t: any) => {
    const cost = Number(t.cost ?? 0);
    if (cost > 0) return s + cost;
    const unit = Number(t.chemicals?.cost_per_unit ?? 0);
    return s + unit * Number(t.quantity ?? 0);
  }, 0);
  const grossIncome = grossReceipts - cogs;

  // --- Part IV: Depreciation ---
  const equipmentRows: EquipmentRow[] = (equipment ?? []) as any;
  const depRows = equipmentRows.map((e) => computeDepreciation(e, year));
  const totalDep = totalYearDepreciation(depRows);

  // --- Part II / V: Expenses, grouped by Schedule C line ---
  type Bucket = {
    line: ScheduleCLine;
    total: number;
    rows: { id: string; date: string; vendor: string | null; category: string | null; amount: number; description: string | null; deductible: boolean }[];
  };
  const buckets = new Map<string, Bucket>();
  for (const line of SCHEDULE_C_LINES.filter((l) => l.part === "II")) {
    buckets.set(line.line, { line, total: 0, rows: [] });
  }
  for (const e of (expenses ?? []) as any[]) {
    const line = mapExpenseRowToScheduleC(e);
    const b = buckets.get(line.line) ?? { line, total: 0, rows: [] };
    b.total += Number(e.amount ?? 0);
    b.rows.push({
      id: e.id,
      date: e.expense_date,
      vendor: e.vendor ?? null,
      category: e.expense_categories?.name ?? null,
      description: e.description ?? null,
      amount: Number(e.amount ?? 0),
      deductible: !!e.tax_deductible,
    });
    buckets.set(line.line, b);
  }
  // Force Line 13 (depreciation) to the system-computed value.
  buckets.set("13", {
    line: SCHEDULE_C_LINES.find((l) => l.line === "13")!,
    total: totalDep,
    rows: depRows.map((d) => ({
      id: d.equipmentId,
      date: d.placedInService ? d.placedInService.toISOString().slice(0, 10) : "",
      vendor: d.name,
      category: `Depreciation (${d.method.replace("_", " ")}, life ${d.usefulLifeYears})`,
      description: null,
      amount: d.yearDepreciation,
      deductible: true,
    })),
  });

  const totalExpenses = Array.from(buckets.values()).reduce((s, b) => s + b.total, 0);
  const netProfit = grossIncome - totalExpenses;

  const years = yearsBack(7, now.getFullYear());

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <Link href="/reports" className="text-sm text-brand-600 hover:underline">← Accounting</Link>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">Tax export — Schedule C</h1>
          <p className="text-sm text-gray-600">
            Cash-basis report aligned to IRS Form 1040 Schedule C, sourced from your payments, expenses,
            and equipment depreciation. <strong>Review with a CPA before filing.</strong>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-end">
          <form className="flex gap-2 items-end">
            <div>
              <label className="text-xs">Tax year</label>
              <select name="year" defaultValue={String(year)} className="w-28">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button className="btn-secondary">Apply</button>
          </form>
          <a href={`/api/reports/tax-export?year=${year}`} className="btn-primary">Download CSV</a>
        </div>
      </div>

      {/* High-level summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Kpi label="Gross receipts" value={fmt(grossReceipts)} />
        <Kpi label="COGS (chemicals used)" value={fmt(cogs)} />
        <Kpi label="Total expenses" value={fmt(totalExpenses)} tone="warn" />
        <Kpi label="Net profit (Line 31)" value={fmt(netProfit)} tone={netProfit >= 0 ? "ok" : "warn"} />
      </div>

      {/* Part I — Income */}
      <section className="card mb-5">
        <header className="px-4 py-3 border-b">
          <h2 className="font-semibold">Part I — Income</h2>
          <p className="text-xs text-gray-500">From payments received in {year}.</p>
        </header>
        <table className="data-table">
          <tbody>
            <Line k="Line 1 — Gross receipts or sales" v={fmt(grossReceipts)} bold />
            <Line k="Line 2 — Returns and allowances" v={fmt(0)} muted />
            <Line k="Line 3 — Subtract line 2 from line 1" v={fmt(grossReceipts)} />
            <Line k="Line 4 — Cost of goods sold (chemicals consumed)" v={fmt(cogs)} muted />
            <Line k="Line 5 — Gross profit" v={fmt(grossReceipts - cogs)} />
            <Line k="Line 6 — Other income" v={fmt(0)} muted />
            <Line k="Line 7 — Gross income" v={fmt(grossIncome)} bold />
          </tbody>
        </table>
      </section>

      {/* Part II — Expenses */}
      <section className="card mb-5">
        <header className="px-4 py-3 border-b flex justify-between items-center">
          <div>
            <h2 className="font-semibold">Part II — Expenses</h2>
            <p className="text-xs text-gray-500">Auto-mapped from your expense categories. CPA should review.</p>
          </div>
          <span className="text-sm font-semibold">Total: {fmt(totalExpenses)}</span>
        </header>
        <table className="data-table">
          <thead>
            <tr><th className="w-16">Line</th><th>Schedule C label</th><th className="text-right">Amount</th></tr>
          </thead>
          <tbody>
            {SCHEDULE_C_LINES.filter((l) => l.part === "II").map((l) => {
              const b = buckets.get(l.line);
              const amount = b?.total ?? 0;
              const hasDetail = (b?.rows.length ?? 0) > 0;
              return (
                <>
                  <tr key={l.line} className={amount > 0 ? "" : "text-gray-400"}>
                    <td className="font-mono text-xs">{l.line}</td>
                    <td>
                      <div className="font-medium">{l.label}</div>
                    </td>
                    <td className="text-right font-medium">{fmt(amount)}</td>
                  </tr>
                  {hasDetail && (
                    <tr key={`${l.line}-detail`}>
                      <td></td>
                      <td colSpan={2}>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-brand-600">View {b!.rows.length} {b!.rows.length === 1 ? "row" : "rows"}</summary>
                          <table className="mt-2 w-full text-xs">
                            <thead className="text-gray-500">
                              <tr><th className="text-left">Date</th><th className="text-left">Vendor / Item</th><th className="text-left">Category</th><th className="text-right">Amount</th></tr>
                            </thead>
                            <tbody>
                              {b!.rows.map((r) => (
                                <tr key={r.id}>
                                  <td>{r.date ? formatDate(r.date) : "—"}</td>
                                  <td>{r.vendor || "—"}</td>
                                  <td className="text-gray-500">{r.category || "—"}</td>
                                  <td className="text-right">{fmt(r.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </details>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            <tr className="bg-gray-50 font-bold">
              <td></td><td>Line 28 — Total expenses</td><td className="text-right">{fmt(totalExpenses)}</td>
            </tr>
            <tr className="font-bold">
              <td></td><td>Line 29 — Tentative profit / (loss)</td><td className="text-right">{fmt(grossIncome - totalExpenses)}</td>
            </tr>
            <tr><td></td><td className="text-gray-500">Line 30 — Home office expenses (manual)</td><td className="text-right text-gray-400">{fmt(0)}</td></tr>
            <tr className="font-bold text-base">
              <td></td>
              <td>Line 31 — Net profit / (loss)</td>
              <td className={`text-right ${netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>{fmt(netProfit)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Part III — COGS detail */}
      <section className="card mb-5">
        <header className="px-4 py-3 border-b">
          <h2 className="font-semibold">Part III — Cost of goods sold (chemicals consumed)</h2>
          <p className="text-xs text-gray-500">
            Sum of <code>usage</code> chemical transactions in {year}, valued at the recorded cost per unit.
          </p>
        </header>
        {!chemicalUsage?.length ? (
          <p className="p-4 text-sm text-gray-500">No chemical usage recorded for {year}.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Chemical</th><th className="text-right">Qty</th><th className="text-right">Cost</th></tr>
            </thead>
            <tbody>
              {(chemicalUsage as any[]).map((t, i) => {
                const cost = Number(t.cost ?? 0) || Number(t.chemicals?.cost_per_unit ?? 0) * Number(t.quantity ?? 0);
                return (
                  <tr key={i}>
                    <td>{formatDate(t.transaction_date)}</td>
                    <td>{t.chemicals?.name ?? "—"}</td>
                    <td className="text-right">{t.quantity}</td>
                    <td className="text-right">{fmt(cost)}</td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 font-bold"><td colSpan={3} className="text-right">Total COGS</td><td className="text-right">{fmt(cogs)}</td></tr>
            </tbody>
          </table>
        )}
      </section>

      {/* Equipment depreciation (Form 4562 detail) */}
      <section className="card mb-5">
        <header className="px-4 py-3 border-b">
          <h2 className="font-semibold">Depreciation detail (Form 4562)</h2>
          <p className="text-xs text-gray-500">
            Straight-line, full-year convention, default 5-year useful life unless overridden on the equipment record.
            A CPA may convert this to MACRS or apply Section 179 / bonus depreciation. Total flows to Line 13 above.
          </p>
        </header>
        {!depRows.length ? (
          <p className="p-4 text-sm text-gray-500">No equipment recorded.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Placed in service</th>
                <th>Method</th>
                <th className="text-right">Life (yrs)</th>
                <th className="text-right">Cost basis</th>
                <th className="text-right">{year} depreciation</th>
                <th className="text-right">Accumulated</th>
                <th className="text-right">Remaining basis</th>
              </tr>
            </thead>
            <tbody>
              {depRows.map((d) => (
                <tr key={d.equipmentId}>
                  <td>{d.name}</td>
                  <td>{d.placedInService ? formatDate(d.placedInService) : "—"}</td>
                  <td className="capitalize">{d.method.replace("_", " ")}</td>
                  <td className="text-right">{d.usefulLifeYears}</td>
                  <td className="text-right">{fmt(d.cost)}</td>
                  <td className="text-right font-medium">{fmt(d.yearDepreciation)}</td>
                  <td className="text-right">{fmt(d.accumDepreciation)}</td>
                  <td className="text-right">{fmt(d.remainingBasis)}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-bold">
                <td colSpan={5} className="text-right">Total depreciation for {year}</td>
                <td className="text-right">{fmt(totalDep)}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      {/* Income detail */}
      <section className="card mb-5">
        <header className="px-4 py-3 border-b">
          <h2 className="font-semibold">Income detail — {year}</h2>
          <p className="text-xs text-gray-500">All payments received within the tax year.</p>
        </header>
        {!payments?.length ? (
          <p className="p-4 text-sm text-gray-500">No payments recorded for {year}.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Customer</th><th>Invoice</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr>
            </thead>
            <tbody>
              {(payments as any[]).map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.payment_date)}</td>
                  <td>{customerDisplayName(p.customers ?? {})}</td>
                  <td>{p.invoices?.invoice_number ?? "—"}</td>
                  <td className="capitalize">{p.payment_method ?? "—"}</td>
                  <td>{p.reference_number ?? "—"}</td>
                  <td className="text-right">{fmt(Number(p.amount))}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-bold">
                <td colSpan={5} className="text-right">Total gross receipts</td>
                <td className="text-right">{fmt(grossReceipts)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      <div className="card-padded bg-yellow-50 border-yellow-300 text-sm">
        <p className="font-semibold mb-1">For your CPA</p>
        <ul className="list-disc pl-5 text-xs text-gray-800 space-y-1">
          <li>Schedule C mapping is auto-generated from your expense category names. Adjust mis-categorized items in the Expenses module before re-running.</li>
          <li>Depreciation here uses straight-line, full-year convention. MACRS, half-year, mid-quarter, bonus, and Section 179 require professional judgement.</li>
          <li>Home-office expenses (Line 30), vehicle business-use percentage, and meal limitations are <strong>not</strong> computed here.</li>
          <li>This is a cash-basis summary. Accrual-basis filers will need adjustments.</li>
          <li>Download the CSV for a complete transaction-level audit trail your CPA can paste into their software.</li>
        </ul>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="card-padded">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-xl sm:text-2xl font-bold mt-1 ${tone === "ok" ? "text-green-700" : tone === "warn" ? "text-amber-600" : ""}`}>{value}</p>
    </div>
  );
}

function Line({ k, v, bold, muted }: { k: string; v: string; bold?: boolean; muted?: boolean }) {
  return (
    <tr className={bold ? "font-bold" : muted ? "text-gray-500" : ""}>
      <td>{k}</td>
      <td className="text-right">{v}</td>
    </tr>
  );
}

function yearsBack(n: number, currentYear: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(currentYear - i);
  return out;
}
