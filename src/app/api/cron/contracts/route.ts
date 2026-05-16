// Process due contracts across every org. Triggered by Vercel cron (GET) or external (POST).
// Authorize via CRON_SECRET bearer header.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { runDueContracts } from "@/app/(app)/contracts/actions";

export const runtime = "nodejs";

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (request.headers.get("user-agent")?.includes("vercel-cron")) return true;
  return false;
}

async function handler(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: orgs } = await (supabase as any)
    .from("contracts")
    .select("organization_id")
    .eq("status", "active")
    .lte("next_run_date", today);

  const uniq = Array.from(new Set((orgs ?? []).map((r: any) => r.organization_id))) as string[];

  let totalProcessed = 0;
  const allErrors: string[] = [];
  for (const orgId of uniq) {
    const { processed, errors } = await runDueContracts(supabase, orgId);
    totalProcessed += processed;
    allErrors.push(...errors);
  }
  return NextResponse.json({ orgs: uniq.length, processed: totalProcessed, errors: allErrors });
}

export const GET = handler;
export const POST = handler;
