// Materialise every recurring job whose next_service_date is on or before today.
// Authorize via CRON_SECRET header. Wire to Vercel Cron with a daily schedule.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { advanceDate, type RecurrenceKind } from "@/lib/recurring";

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
  const { data: due } = await (supabase as any)
    .from("recurring_jobs")
    .select("*")
    .eq("active", true)
    .lte("next_service_date", today)
    .limit(200);

  let spawned = 0;
  let failed = 0;

  for (const r of (due ?? []) as any[]) {
    try {
      const start = new Date(r.next_service_date + "T09:00:00");
      const end = new Date(start.getTime() + (r.duration_minutes ?? 60) * 60_000);
      const { error: jErr } = await (supabase as any).from("jobs").insert({
        organization_id: r.organization_id,
        customer_id: r.customer_id,
        property_id: r.property_id,
        title: r.title,
        description: r.description,
        status: "scheduled",
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        total_amount: Number(r.default_price ?? 0),
        duration_minutes: r.duration_minutes ?? 60,
        recurring_job_id: r.id,
      });
      if (jErr) throw jErr;
      const next = advanceDate(r.next_service_date, r.recurrence_kind as RecurrenceKind, r.recurrence_interval ?? 1);
      await (supabase as any)
        .from("recurring_jobs")
        .update({ last_service_date: r.next_service_date, next_service_date: next, updated_at: new Date().toISOString() })
        .eq("id", r.id);
      spawned++;
    } catch (e) {
      console.error("recurring spawn failed", r.id, e);
      failed++;
    }
  }

  return NextResponse.json({ processed: due?.length ?? 0, spawned, failed });
}
