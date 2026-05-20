import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";
import { estimatePdf } from "@/lib/document-pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { data: est } = await supabase
    .from("estimates")
    .select("*, customers(*), estimate_line_items(*)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!est) return new NextResponse("Not found", { status: 404 });

  const items = ((est as any).estimate_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const bytes = await estimatePdf({
    org: organization as any,
    customer: (est as any).customers,
    estimateNumber: (est as any).estimate_number,
    issueDate: (est as any).issue_date,
    expiresAt: (est as any).expires_at,
    items: items.map((li) => ({
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      total: Number(li.total),
      materials_description: li.materials_description ?? null,
      materials_cost: Number(li.materials_cost ?? 0),
    })),
    subtotal: Number((est as any).subtotal),
    discount: Number((est as any).discount_amount ?? 0),
    taxRate: Number((est as any).tax_rate ?? 0),
    tax: Number((est as any).tax_amount ?? 0),
    total: Number((est as any).total),
    notes: (est as any).notes,
    terms: (est as any).terms,
    currency: (organization as any)?.currency,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${(est as any).estimate_number}.pdf"`,
    },
  });
}
