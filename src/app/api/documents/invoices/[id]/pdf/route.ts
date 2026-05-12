import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";
import { invoicePdfBuffer } from "@/lib/document-pdf";
import { documentLabel } from "@/lib/document-number";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { data: inv } = await supabase
    .from("invoices")
    .select("*, customers(*), invoice_line_items(*)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!inv) return new NextResponse("Not found", { status: 404 });

  const items = (inv.invoice_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const paid = inv.status === "paid";
  const label = documentLabel("invoice", inv.status, inv.invoice_number);
  const buffer = await invoicePdfBuffer({
    org: organization,
    customer: inv.customers as any,
    invoiceNumber: label,
    issueDate: inv.issue_date,
    dueDate: inv.due_date,
    items: items.map((li) => ({
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      total: Number(li.total),
    })),
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount_amount),
    taxRate: Number(inv.tax_rate),
    tax: Number(inv.tax_amount),
    total: Number(inv.total),
    amountPaid: Number(inv.amount_paid),
    balanceDue: Number(inv.balance_due),
    notes: inv.notes,
    terms: inv.terms,
    paid,
    currency: organization?.currency,
  });

  const url = new URL(req.url);
  const download = url.searchParams.get("download") === "1";
  const disposition = download
    ? `attachment; filename="${label}.pdf"`
    : `inline; filename="${label}.pdf"`;
  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
    },
  });
}
