import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";
import { estimateHtml } from "@/lib/document-html";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  // Pull the estimate, its line items, and any document-level reference
  // photos in parallel. The "View / Print" link used to skip the photos
  // join entirely, so customer-facing PDFs were missing every picture
  // the operator attached during the create / edit flow.
  const [{ data: est }, { data: photos }] = await Promise.all([
    supabase
      .from("estimates")
      .select("*, customers(*), estimate_line_items(*)")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single(),
    supabase
      .from("photo_attachments")
      .select("url, caption, created_at")
      .eq("estimate_id", id)
      .eq("organization_id", organizationId)
      .eq("kind", "reference")
      .order("created_at", { ascending: true }),
  ]);
  if (!est) return new NextResponse("Not found", { status: 404 });

  const items = (est.estimate_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const html = estimateHtml({
    org: organization,
    customer: est.customers as any,
    estimateNumber: est.estimate_number,
    issueDate: est.issue_date,
    expiresAt: est.expires_at,
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
    subtotal: Number(est.subtotal),
    discount: Number(est.discount_amount),
    taxRate: Number(est.tax_rate),
    tax: Number(est.tax_amount),
    total: Number(est.total),
    laborSubtotal: Number(est.labor_subtotal ?? 0),
    materialsSubtotal: Number(est.materials_subtotal ?? 0),
    taxableSubtotal: Number(est.taxable_subtotal ?? est.subtotal ?? 0),
    notes: est.notes,
    terms: est.terms,
    currency: organization?.currency,
  });
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
