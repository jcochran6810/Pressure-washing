import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";
import { invoiceHtml } from "@/lib/document-html";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  // Pull doc + line items + any document-level reference photos in parallel.
  // Without the photos join the customer-facing PDF was missing every
  // picture the operator attached during the create / edit flow.
  const [{ data: inv }, { data: photos }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, customers(*), invoice_line_items(*)")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single(),
    supabase
      .from("photo_attachments")
      .select("url, caption, created_at")
      .eq("invoice_id", id)
      .eq("organization_id", organizationId)
      .eq("kind", "reference")
      .order("created_at", { ascending: true }),
  ]);
  if (!inv) return new NextResponse("Not found", { status: 404 });

  const items = (inv.invoice_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const html = invoiceHtml({
    org: organization,
    customer: inv.customers as any,
    invoiceNumber: inv.invoice_number,
    issueDate: inv.issue_date,
    dueDate: inv.due_date,
    items: items.map((li) => ({
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      total: Number(li.total),
      photo_urls: li.photo_urls ?? [],
      kind: li.kind ?? "service",
      taxable: li.taxable ?? true,
    })),
    docPhotos: (photos ?? []).map((p: any) => ({ url: p.url, note: p.caption ?? null })),
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount_amount),
    taxRate: Number(inv.tax_rate),
    tax: Number(inv.tax_amount),
    total: Number(inv.total),
    amountPaid: Number(inv.amount_paid),
    balanceDue: Number(inv.balance_due),
    laborSubtotal: Number(inv.labor_subtotal ?? 0),
    materialsSubtotal: Number(inv.materials_subtotal ?? 0),
    taxableSubtotal: Number(inv.taxable_subtotal ?? inv.subtotal ?? 0),
    notes: inv.notes,
    terms: inv.terms,
    paid: inv.status === "paid",
    currency: organization?.currency,
  });
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
