import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { estimatePdf } from "@/lib/document-pdf";

export const dynamic = "force-dynamic";

function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = publicClient();
  const { data: est } = await supabase
    .from("estimates")
    .select("*, customers(*), organizations(*), estimate_line_items(*)")
    .eq("approval_token", token)
    .maybeSingle();
  if (!est) return new NextResponse("Not found", { status: 404 });

  // Honour the 30-day window even on the public download.
  if ((est as any).expires_at && new Date((est as any).expires_at) < new Date()) {
    return new NextResponse("This estimate has expired.", { status: 410 });
  }

  const items = ((est as any).estimate_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const bytes = await estimatePdf({
    org: (est as any).organizations,
    customer: (est as any).customers,
    estimateNumber: (est as any).estimate_number,
    issueDate: (est as any).issue_date,
    expiresAt: (est as any).expires_at,
    items: items.map((li) => ({
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      total: Number(li.total),
    })),
    subtotal: Number((est as any).subtotal),
    discount: Number((est as any).discount_amount ?? 0),
    taxRate: Number((est as any).tax_rate ?? 0),
    tax: Number((est as any).tax_amount ?? 0),
    total: Number((est as any).total),
    notes: (est as any).notes,
    terms: (est as any).terms,
    currency: (est as any).organizations?.currency,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${(est as any).estimate_number}.pdf"`,
    },
  });
}
