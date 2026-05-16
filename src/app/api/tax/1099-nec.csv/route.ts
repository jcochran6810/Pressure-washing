import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const NEC_THRESHOLD = 600;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount, vendor, expense_date, description")
    .eq("organization_id", organizationId)
    .gte("expense_date", start).lte("expense_date", end);

  const byVendor = new Map<string, number>();
  (expenses ?? []).forEach((e: any) => {
    const vendor = (e.vendor ?? "").trim();
    if (!vendor) return;
    byVendor.set(vendor, (byVendor.get(vendor) ?? 0) + Number(e.amount ?? 0));
  });

  const rows = Array.from(byVendor.entries())
    .filter(([, amt]) => amt >= NEC_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .map(([vendor, amt]) => ({
      Vendor: vendor,
      "Total paid": amt.toFixed(2),
      Action: year >= new Date().getFullYear() ? "(in progress)" : "Issue 1099-NEC",
    }));

  const csv = toCsv(rows, ["Vendor", "Total paid", "Action"]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="1099-nec-eligible-${year}.csv"`,
    },
  });
}
