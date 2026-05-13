// Process due contracts across every org. Auth via CRON_SECRET header.
// Recommended cadence: daily.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { runDueContracts } from "@/app/(app)/contracts/actions";

export const runtime = "nodejs";

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
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
