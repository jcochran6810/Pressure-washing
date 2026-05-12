import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";
import { SCHEDULE_C_LINES, mapExpenseRowToScheduleC } from "@/lib/schedule-c";
import { computeDepreciation, totalYearDepreciation, type EquipmentRow } from "@/lib/depreciation";
import { customerDisplayName } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// CSV-quote a single cell value.
function q(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
function row(cells: (string | number | null | undefined)[]) {
  return cells.map(q).join(",");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
  const { supabase, organizationId, organization } = await getSessionAndOrg();

  const startStr = `${year}-01-01`;
  const endStr = `${year}-12-31`;

  const [{ data: payments }, { data: expenses }, { data: equipment }, { data: chemicalUsage }] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, payment_date, payment_method, reference_number, customers(first_name, last_name, company_name), invoices(invoice_number)")
      .eq("organization_id", organizationId)
      .gte("payment_date", startStr)
      .lte("payment_date", endStr)
      .order("payment_date"),
    supabase
      .from("expenses")
      .select("amount, expense_date, vendor, description, payment_method, tax_deductible, receipt_url, expense_categories(name)")
      .eq("organization_id", organizationId)
      .gte("expense_date", startStr)
      .lte("expense_date", endStr)
      .order("expense_date"),
    supabase
      .from("equipment")
      .select("*")
      .eq("organization_id", organizationId)
      .order("purchase_date", { ascending: true }),
    supabase
      .from("chemical_transactions")
      .select("quantity, cost, transaction_date, chemicals(name, cost_per_unit)")
      .eq("organization_id", organizationId)
      .gte("transaction_date", startStr)
      .lte("transaction_date", endStr)
      .eq("transaction_type", "usage"),
  ]);

  const grossReceipts = (payments ?? []).reduce((s, p: any) => s + Number(p.amount ?? 0), 0);
  const cogs = (chemicalUsage ?? []).reduce((s, t: any) => {
    const c = Number(t.cost ?? 0);
    if (c > 0) return s + c;
    return s + Number(t.chemicals?.cost_per_unit ?? 0) * Number(t.quantity ?? 0);
  }, 0);
  const grossIncome = grossReceipts - cogs;

  const depRows = ((equipment ?? []) as EquipmentRow[]).map((e) => computeDepreciation(e, year));
  const totalDep = totalYearDepreciation(depRows);

  // Bucket expenses by Schedule C line
  const byLine = new Map<string, number>();
  for (const e of (expenses ?? []) as any[]) {
    const line = mapExpenseRowToScheduleC(e).line;
    byLine.set(line, (byLine.get(line) ?? 0) + Number(e.amount ?? 0));
  }
  // Override Line 13 with computed depreciation total
  byLine.set("13", totalDep);

  const totalExpenses = Array.from(byLine.values()).reduce((s, v) => s + v, 0);
  const netProfit = grossIncome - totalExpenses;

  const out: string[] = [];
  const push = (...lines: (string | string[])[]) => {
    for (const l of lines) {
      if (Array.isArray(l)) out.push(...l);
      else out.push(l);
    }
  };

  // Header
  push(`# Schedule C Tax Export`);
  push(`# Organization,${q(organization?.name ?? "")}`);
  push(`# Tax year,${year}`);
  push(`# Generated,${new Date().toISOString()}`);
  push(`# Currency,${organization?.currency ?? "USD"}`);
  push(`# NOTE: Cash-basis summary. Review with a CPA before filing.`);
  push("");

  // --- Summary
  push(`## Schedule C summary`);
  push(row(["Line", "Label", "Amount"]));
  push(row(["1", "Gross receipts or sales", grossReceipts.toFixed(2)]));
  push(row(["4", "Cost of goods sold (chemicals consumed)", cogs.toFixed(2)]));
  push(row(["7", "Gross income", grossIncome.toFixed(2)]));
  for (const l of SCHEDULE_C_LINES.filter((x) => x.part === "II")) {
    const v = byLine.get(l.line) ?? 0;
    push(row([l.line, l.label, v.toFixed(2)]));
  }
  push(row(["28", "Total expenses", totalExpenses.toFixed(2)]));
  push(row(["29", "Tentative profit / (loss)", (grossIncome - totalExpenses).toFixed(2)]));
  push(row(["30", "Home office expenses (manual)", "0.00"]));
  push(row(["31", "Net profit / (loss)", netProfit.toFixed(2)]));
  push("");

  // --- Income
  push(`## Income detail (payments)`);
  push(row(["Date", "Customer", "Invoice", "Method", "Reference", "Amount"]));
  for (const p of (payments ?? []) as any[]) {
    push(
      row([
        p.payment_date,
        customerDisplayName(p.customers ?? {}),
        p.invoices?.invoice_number ?? "",
        p.payment_method ?? "",
        p.reference_number ?? "",
        Number(p.amount ?? 0).toFixed(2),
      ]),
    );
  }
  push(row(["", "", "", "", "Total", grossReceipts.toFixed(2)]));
  push("");

  // --- Expenses
  push(`## Expense detail`);
  push(row(["Date", "Vendor", "Category", "Schedule C line", "Schedule C label", "Description", "Deductible", "Payment method", "Receipt URL", "Amount"]));
  for (const e of (expenses ?? []) as any[]) {
    const line = mapExpenseRowToScheduleC(e);
    push(
      row([
        e.expense_date,
        e.vendor ?? "",
        e.expense_categories?.name ?? "",
        line.line,
        line.label,
        e.description ?? "",
        e.tax_deductible ? "Y" : "N",
        e.payment_method ?? "",
        e.receipt_url ?? "",
        Number(e.amount ?? 0).toFixed(2),
      ]),
    );
  }
  push("");

  // --- COGS detail
  push(`## Cost of goods sold detail (chemical usage)`);
  push(row(["Date", "Chemical", "Quantity", "Cost"]));
  for (const t of (chemicalUsage ?? []) as any[]) {
    const c = Number(t.cost ?? 0) || Number(t.chemicals?.cost_per_unit ?? 0) * Number(t.quantity ?? 0);
    push(row([t.transaction_date, t.chemicals?.name ?? "", t.quantity, c.toFixed(2)]));
  }
  push(row(["", "", "Total COGS", cogs.toFixed(2)]));
  push("");

  // --- Depreciation
  push(`## Equipment depreciation detail`);
  push(
    row([
      "Equipment",
      "Placed in service",
      "Method",
      "Useful life (yrs)",
      "Cost basis",
      "Salvage value",
      `${year} depreciation`,
      "Accumulated depreciation",
      "Remaining basis",
      "Notes",
    ]),
  );
  for (const d of depRows) {
    push(
      row([
        d.name,
        d.placedInService ? d.placedInService.toISOString().slice(0, 10) : "",
        d.method,
        d.usefulLifeYears,
        d.cost.toFixed(2),
        d.salvage.toFixed(2),
        d.yearDepreciation.toFixed(2),
        d.accumDepreciation.toFixed(2),
        d.remainingBasis.toFixed(2),
        d.notes ?? "",
      ]),
    );
  }
  push(row(["Total", "", "", "", "", "", totalDep.toFixed(2), "", "", ""]));
  push("");

  const body = out.join("\r\n");
  const filename = `schedule-c-${year}-${(organization?.name ?? "org").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
