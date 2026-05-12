// Process due reminders. Call from an external cron (Vercel cron, GitHub Actions,
// or supabase scheduled function). Authorize via CRON_SECRET header.
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendEmail } from "@/lib/email";
import { sendSMS, isSMSConfigured, bestCustomerPhone } from "@/lib/sms";

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
  const now = new Date().toISOString();
  const { data: due } = await supabase
    .from("customer_reminders")
    .select("*, customers(first_name, last_name, email, phone, mobile_phone), organizations(name, email)")
    .eq("status", "scheduled")
    .lte("scheduled_for", now)
    .limit(50);

  let sent = 0;
  let skipped = 0;
  for (const r of due ?? []) {
    const c: any = r.customers;
    const org: any = r.organizations;
    if (!c) { skipped++; continue; }

    // Channel selection:
    //   1. Reminder row explicitly asked for 'sms' -> SMS (if available + phone)
    //   2. Reminder asked for 'email' -> email (if customer has email)
    //   3. No email but a phone + SMS configured -> fall back to SMS
    //   4. Otherwise skip
    const phone = bestCustomerPhone(c);
    const wantsSMS = r.channel === "sms";
    const useSMS =
      isSMSConfigured() && !!phone && (wantsSMS || (!c.email && r.channel !== "email"));

    const subject =
      r.kind === "appointment" ? `Reminder — appointment with ${org?.name}` :
      r.kind === "recurring_service" ? `It's been a while — schedule your next service?` :
      r.kind === "review_request" ? `How did we do?` :
      `Quick note from ${org?.name}`;

    let result: { ok: boolean; reason?: string };
    let usedChannel: "email" | "sms" = "email";

    if (useSMS && phone) {
      usedChannel = "sms";
      const body =
        r.message
          ? `${org?.name ?? ""}: ${r.message}`
          : `${org?.name ?? ""}: ${subject}`;
      const smsRes = await sendSMS({ to: phone, body: body.slice(0, 320) });
      result = { ok: smsRes.ok, reason: smsRes.ok ? undefined : smsRes.reason };
    } else if (c.email) {
      const html = `<!doctype html><body style="font-family:system-ui,sans-serif;padding:24px;background:#f8fafc;">
        <div style="max-width:480px;margin:0 auto;background:#fff;padding:24px;border-radius:12px;border:1px solid #e2e8f0;">
          <p>Hi ${c.first_name || ""},</p>
          <p>${r.message || subject}</p>
          <p style="color:#64748b;font-size:12px;margin-top:24px;">${org?.name}${org?.email ? ` · ${org.email}` : ""}</p>
        </div>
      </body></html>`;
      const emailRes = await sendEmail({ to: c.email, subject, html, replyTo: org?.email });
      result = { ok: emailRes.ok, reason: emailRes.ok ? undefined : emailRes.reason };
    } else {
      skipped++;
      continue;
    }

    await supabase
      .from("customer_reminders")
      .update({
        status: result.ok ? "sent" : "failed",
        channel: usedChannel,
        sent_at: result.ok ? new Date().toISOString() : null,
      })
      .eq("id", r.id);
    if (result.ok) sent++;
    else skipped++;
  }

  return NextResponse.json({ processed: due?.length ?? 0, sent, skipped });
}
