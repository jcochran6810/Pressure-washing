import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";
import { estimatePdfBuffer } from "@/lib/document-pdf";
import { documentLabel } from "@/lib/document-number";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const label = documentLabel("estimate", est.status, est.estimate_number);
  const buffer = await estimatePdfBuffer({
    org: organization,
    customer: est.customers as any,
    estimateNumber: label,
    issueDate: est.issue_date,
    expiresAt: est.expires_at,
    items: items.map((li) => ({
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      total: Number(li.total),
    })),
    subtotal: Number(est.subtotal),
    discount: Number(est.discount_amount),
    taxRate: Number(est.tax_rate),
    tax: Number(est.tax_amount),
    total: Number(est.total),
    notes: est.notes,
    terms: est.terms,
    currency: organization?.currency,
  });

  // ?download=1 forces a Save-As dialog; default is inline view in the browser.
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
