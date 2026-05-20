import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";
import { invoicePdf } from "@/lib/document-pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { data: inv } = await supabase
    .from("invoices")
    .select("*, customers(*), invoice_line_items(*)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!inv) return new NextResponse("Not found", { status: 404 });
  const items = ((inv as any).invoice_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const bytes = await invoicePdf({
    org: organization as any,
    customer: (inv as any).customers,
    invoiceNumber: (inv as any).invoice_number,
    issueDate: (inv as any).issue_date,
    dueDate: (inv as any).due_date,
    items: items.map((li) => ({
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      total: Number(li.total),
      materials_description: li.materials_description ?? null,
      materials_cost: Number(li.materials_cost ?? 0),
    })),
    subtotal: Number((inv as any).subtotal),
    discount: Number((inv as any).discount_amount ?? 0),
    taxRate: Number((inv as any).tax_rate ?? 0),
    tax: Number((inv as any).tax_amount ?? 0),
    total: Number((inv as any).total),
    amountPaid: Number((inv as any).amount_paid ?? 0),
    balanceDue: Number((inv as any).balance_due ?? 0),
    notes: (inv as any).notes,
    terms: (inv as any).terms,
    paid: (inv as any).status === "paid",
    currency: (organization as any)?.currency,
  });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${(inv as any).invoice_number}.pdf"`,
    },
  });
}
