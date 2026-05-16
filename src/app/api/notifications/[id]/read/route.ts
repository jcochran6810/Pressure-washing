import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .is("read_at", null);
  return NextResponse.json({ ok: true });
}
