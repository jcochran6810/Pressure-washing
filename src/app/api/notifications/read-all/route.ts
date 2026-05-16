import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

export async function POST() {
  const { supabase, organizationId, user } = await getSessionAndOrg();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .is("read_at", null);
  return NextResponse.json({ ok: true });
}
