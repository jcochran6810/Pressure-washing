import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

// IRS 1099-NEC threshold for non-employee compensation reporting
const NEC_THRESHOLD = 600;

export default async function TaxPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { year } = await searchParams;
  const selectedYear = Number(year) || new Date().getFullYear();
  const start = `${selectedYear}-01-01`;
  const end = `${selectedYear}-12-31`;

  const [{ data: payments }, { data: expenses }, { data: categories }] = await Promise.all([
    supabase.from("payments")
      .select("amount, payment_date")
      .eq("organization_id", organizationId)
      .gte("payment_date", start).lte("payment_date", end),
    supabase.from("expenses")
      .select("amount, expense_date, vendor, category_id, tax_deductible, expense_categories(name)")
      .eq("organization_id", organizationId)
      .gte("expense_date", start).lte("expense_date", end),
    supabase.from("expense_categories").select("id, name").eq("organization_id", organizationId),
  ]);

  const grossReceipts = (payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const deductibleExpenses = (expenses ?? []).filter((e: any) => e.tax_deductible).reduce((s, e) => s + Number(e.amount ?? 0), 0);
  const netProfit = grossReceipts - deductibleExpenses;

  // Schedule C category breakdown
  const byCategory = new Map<string, number>();
  (expenses ?? []).forEach((e: any) => {
    if (!e.tax_deductible) return;
    const name = e.expense_categories?.name || "Other expenses";
    byCategory.set(name, (byCategory.get(name) ?? 0) + Number(e.amount ?? 0));
  });
  const sortedCategories = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);

  // 1099-NEC eligible vendors: sum payments to each vendor over $600
  const byVendor = new Map<string, number>();
  (expenses ?? []).forEach((e: any) => {
    const vendor = (e.vendor ?? "").trim();
    if (!vendor) return;
    byVendor.set(vendor, (byVendor.get(vendor) ?? 0) + Number(e.amount ?? 0));
  });
  const necVendors = Array.from(byVendor.entries())
    .filter(([, amt]) => amt >= NEC_THRESHOLD)
    .sort((a, b) => b[1] - a[1]);

  const years = [selectedYear + 1, selectedYear, selectedYear - 1, selectedYear - 2].filter((y) => y <= new Date().getFullYear());

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Tax forms</h1>
          <p className="text-sm text-gray-500 mt-1">
            Summary numbers for {organization?.name}. Hand to your accountant or feed into TurboTax / H&amp;R Block.
            Not legal/tax advice — talk to a CPA before filing.
          </p>
        </div>
        <div className="flex gap-1">
          {years.map((y) => (
            <Link key={y} href={`/tax?year=${y}`} className={`badge ${y === selectedYear ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              {y}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <KpiCard label="Gross receipts" value={formatCurrency(grossReceipts)} hint="Line 1 of Schedule C" />
        <KpiCard label="Deductible expenses" value={formatCurrency(deductibleExpenses)} hint="Total business expenses (Part II)" />
        <KpiCard label="Net profit / (loss)" value={formatCurrency(netProfit)} hint="Line 31 of Schedule C" emphasize={netProfit >= 0 ? "ok" : "warn"} />
      </div>

      <section className="card-padded mb-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold">Schedule C — Part II (Expenses)</h2>
          <a
            href={`/api/tax/schedule-c.csv?year=${selectedYear}`}
            className="btn-secondary text-xs"
          >Download CSV</a>
        </div>
        {sortedCategories.length === 0 ? (
          <p className="text-sm text-gray-500">No deductible expenses recorded for {selectedYear}.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Category</th><th className="text-right">Amount</th><th className="text-right">% of total</th></tr></thead>
            <tbody>
              {sortedCategories.map(([name, amt]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td className="text-right font-medium">{formatCurrency(amt)}</td>
                  <td className="text-right text-gray-500 text-xs">{deductibleExpenses > 0 ? ((amt / deductibleExpenses) * 100).toFixed(1) : "0"}%</td>
                </tr>
              ))}
              <tr className="font-semibold border-t-2 border-gray-200">
                <td>Total deductible</td>
                <td className="text-right">{formatCurrency(deductibleExpenses)}</td>
                <td className="text-right">100%</td>
              </tr>
              {totalExpenses > deductibleExpenses && (
                <tr className="text-xs text-gray-500">
                  <td>Non-deductible expenses (not on Schedule C)</td>
                  <td className="text-right">{formatCurrency(totalExpenses - deductibleExpenses)}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      <section className="card-padded mb-5">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div>
            <h2 className="font-semibold">1099-NEC eligible vendors</h2>
            <p className="text-xs text-gray-500">
              Any non-corporate vendor paid <strong>${NEC_THRESHOLD}+</strong> for services in {selectedYear} needs a 1099-NEC (due to recipient by Jan 31).
              Collect W-9 forms now.
            </p>
          </div>
          <a
            href={`/api/tax/1099-nec.csv?year=${selectedYear}`}
            className="btn-secondary text-xs"
          >Download CSV</a>
        </div>
        {necVendors.length === 0 ? (
          <p className="text-sm text-gray-500 mt-2">No vendors crossed the ${NEC_THRESHOLD} threshold in {selectedYear}.</p>
        ) : (
          <table className="data-table mt-2">
            <thead><tr><th>Vendor</th><th className="text-right">Paid</th><th>Action</th></tr></thead>
            <tbody>
              {necVendors.map(([vendor, amt]) => (
                <tr key={vendor}>
                  <td className="font-medium">{vendor}</td>
                  <td className="text-right">{formatCurrency(amt)}</td>
                  <td className="text-xs text-gray-500">Request W-9 if not on file</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="text-xs text-gray-500 mt-4">
        <strong>Disclaimer:</strong> These figures are derived from your recorded expenses and payments. They do not include depreciation,
        home office allocation, mileage (unless you logged it as an expense), retirement contributions, or self-employment tax.
        Always have a CPA review your return before filing.
      </p>
    </div>
  );
}

function KpiCard({ label, value, hint, emphasize }: { label: string; value: string; hint: string; emphasize?: "ok" | "warn" }) {
  const color =
    emphasize === "ok" ? "text-green-700" :
    emphasize === "warn" ? "text-red-700" : "text-gray-900";
  return (
    <div className="card-padded">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{hint}</p>
    </div>
  );
}
