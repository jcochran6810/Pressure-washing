import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, organizationId, user } = await getSessionAndOrg();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, url, read_at, created_at")
    .eq("organization_id", organizationId)
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(40);
  return NextResponse.json({ items: data ?? [] });
}
