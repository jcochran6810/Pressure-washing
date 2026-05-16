// Process due reminders. Triggered by Vercel cron (GET) or external scheduler (POST).
// Authorize via CRON_SECRET bearer header.
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendEmail } from "@/lib/email";

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
  const now = new Date().toISOString();
  const { data: due } = await supabase
    .from("customer_reminders")
    .select("*, customers(first_name, last_name, email), organizations(name, email)")
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .limit(50);

  let sent = 0;
  let skipped = 0;
  for (const r of due ?? []) {
    const c: any = (r as any).customers;
    const org: any = (r as any).organizations;
    if (!c?.email) { skipped++; continue; }
    const subject =
      r.kind === "appointment" ? `Reminder — appointment with ${org?.name}` :
      r.kind === "recurring_service" ? `It's been a while — schedule your next service?` :
      r.kind === "review_request" ? `How did we do?` :
      `Quick note from ${org?.name}`;
    const html = `<!doctype html><body style="font-family:system-ui,sans-serif;padding:24px;background:#f8fafc;">
      <div style="max-width:480px;margin:0 auto;background:#fff;padding:24px;border-radius:12px;border:1px solid #e2e8f0;">
        <p>Hi ${c.first_name || ""},</p>
        <p>${r.message || subject}</p>
        <p style="color:#64748b;font-size:12px;margin-top:24px;">${org?.name}${org?.email ? ` · ${org.email}` : ""}</p>
      </div>
    </body></html>`;
    const result = await sendEmail({ to: c.email, subject, html, replyTo: org?.email });
    await supabase.from("customer_reminders").update({
      status: result.ok ? "sent" : "failed",
      sent_at: result.ok ? new Date().toISOString() : null,
    }).eq("id", r.id);
    if (result.ok) sent++; else skipped++;
  }

  return NextResponse.json({ processed: due?.length ?? 0, sent, skipped });
}

export const GET = handler;
export const POST = handler;
