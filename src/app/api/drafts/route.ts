import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { supabase, organizationId, user } = await getSessionAndOrg();
  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  if (!entityType) return NextResponse.json({ error: "entityType required" }, { status: 400 });

  let q = supabase
    .from("drafts")
    .select("id, payload, updated_at")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("entity_type", entityType);
  if (entityId) q = q.eq("entity_id", entityId);
  else q = q.is("entity_id", null);

  const { data } = await q.maybeSingle();
  return NextResponse.json({ draft: data ?? null });
}

export async function POST(request: Request) {
  const { supabase, organizationId, user } = await getSessionAndOrg();
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const entityType = String(body?.entityType || "");
  const entityId = body?.entityId ? String(body.entityId) : null;
  const payload = body?.payload ?? {};
  if (!["estimate", "invoice"].includes(entityType)) {
    return NextResponse.json({ error: "invalid entityType" }, { status: 400 });
  }

  // Upsert keyed on (user_id, entity_type, entity_id)
  const { error } = await supabase
    .from("drafts")
    .upsert(
      {
        organization_id: organizationId,
        user_id: user.id,
        entity_type: entityType,
        entity_id: entityId,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,entity_type,entity_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, organizationId, user } = await getSessionAndOrg();
  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");
  let q = supabase
    .from("drafts")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", user.id);
  if (entityType) q = q.eq("entity_type", entityType);
  if (entityId) q = q.eq("entity_id", entityId);
  await q;
  return NextResponse.json({ ok: true });
}
