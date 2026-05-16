import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const { supabase, organizationId } = await getSessionAndOrg();
  const [{ data: payments }, { data: expenses }] = await Promise.all([
    supabase.from("payments")
      .select("amount, payment_date")
      .eq("organization_id", organizationId)
      .gte("payment_date", start).lte("payment_date", end),
    supabase.from("expenses")
      .select("amount, vendor, expense_date, description, tax_deductible, expense_categories(name)")
      .eq("organization_id", organizationId)
      .gte("expense_date", start).lte("expense_date", end),
  ]);

  const grossReceipts = (payments ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const byCat = new Map<string, number>();
  (expenses ?? []).forEach((e: any) => {
    if (!e.tax_deductible) return;
    const name = e.expense_categories?.name || "Other expenses";
    byCat.set(name, (byCat.get(name) ?? 0) + Number(e.amount ?? 0));
  });

  const totalExpenses = Array.from(byCat.values()).reduce((s, a) => s + a, 0);
  const rows: Array<{ Item: string; Amount: string }> = [
    { Item: "Year", Amount: String(year) },
    { Item: "Section", Amount: "Schedule C summary" },
    { Item: "", Amount: "" },
    { Item: "Line 1 — Gross receipts", Amount: grossReceipts.toFixed(2) },
    { Item: "", Amount: "" },
    { Item: "Part II — Expenses by category", Amount: "" },
    ...Array.from(byCat.entries()).map(([name, amt]) => ({ Item: name, Amount: amt.toFixed(2) })),
    { Item: "", Amount: "" },
    { Item: "Line 28 — Total expenses", Amount: totalExpenses.toFixed(2) },
    { Item: "Line 31 — Net profit/(loss)", Amount: (grossReceipts - totalExpenses).toFixed(2) },
  ];

  const csv = toCsv(rows, ["Item", "Amount"]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="schedule-c-${year}.csv"`,
    },
  });
}
