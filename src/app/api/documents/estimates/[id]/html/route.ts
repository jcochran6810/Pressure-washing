import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";
import { estimateHtml } from "@/lib/document-html";

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
  const items = (est.estimate_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const html = estimateHtml({
    org: organization,
    customer: est.customers as any,
    estimateNumber: est.estimate_number,
    issueDate: est.issue_date,
    expiresAt: est.expires_at,
    items: items.map((li) => ({ description: li.description, quantity: Number(li.quantity), unit_price: Number(li.unit_price), total: Number(li.total) })),
    subtotal: Number(est.subtotal), discount: Number(est.discount_amount), taxRate: Number(est.tax_rate),
    tax: Number(est.tax_amount), total: Number(est.total),
    notes: est.notes, terms: est.terms,
    preparedBy: (est as any).prepared_by ?? null,
    depositAmount: (est as any).deposit_amount ? Number((est as any).deposit_amount) : null,
    currency: organization?.currency,
  });
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
