// Trial lifecycle cron. Runs daily. Sends:
//   * 7-day-before-trial-end warning email (once per org)
//   * 1-day-before-trial-end warning email (once per org)
//   * trial-expired notice (once) and flips subscription_status to 'trial_expired'
//     if no active sub is in place
//
// Idempotent — guarded by trial_reminder_*_at timestamps on organizations.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendEmail } from "@/lib/email";
import { PLATFORM_NAME } from "@/lib/platform";

export const runtime = "nodejs";

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function tierSummary(tier: string): string {
  const map: Record<string, { label: string; price: number }> = {
    basic: { label: "Basic", price: 5 },
    plus: { label: "Plus", price: 15 },
    pro: { label: "Pro", price: 45 },
  };
  const t = map[tier] ?? map.basic;
  return `${t.label} ($${t.price}/mo)`;
}

function emailShell(title: string, body: string, ctaUrl: string, ctaLabel: string) {
  return `<!doctype html><body style="font-family:system-ui,sans-serif;padding:24px;background:#f8fafc;">
    <div style="max-width:520px;margin:0 auto;background:#fff;padding:24px;border-radius:12px;border:1px solid #e2e8f0;">
      <h1 style="margin:0 0 12px;font-size:18px;">${title}</h1>
      ${body}
      <p style="margin-top:24px;">
        <a href="${ctaUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">${ctaLabel}</a>
      </p>
      <p style="color:#94a3b8;font-size:11px;margin-top:24px;">Sent by ${PLATFORM_NAME}.</p>
    </div></body>`;
}

async function adminEmailsForOrg(supabase: any, orgId: string): Promise<string[]> {
  const { data } = await supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", orgId)
    .in("role", ["owner", "admin"]);
  if (!data?.length) return [];
  const userIds = data.map((m: any) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name");
  // profiles doesn't carry email; pull from auth.users
  const emails: string[] = [];
  for (const uid of userIds) {
    const { data: u } = await (supabase.auth as any).admin?.getUserById?.(uid).catch?.(() => ({ data: null })) ?? { data: null };
    if (u?.user?.email) emails.push(u.user.email);
  }
  return emails;
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 86400000);
  const oneDay = new Date(now.getTime() + 1 * 86400000);

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, subscription_tier, subscription_status, trial_ends_at, trial_reminder_7d_at, trial_reminder_1d_at, trial_expired_email_at")
    .not("trial_ends_at", "is", null);

  let sent7d = 0, sent1d = 0, sentExpired = 0, downgraded = 0;

  for (const o of (orgs as any[]) ?? []) {
    if (ACTIVE_STATUSES.has(o.subscription_status)) continue;
    const trialEnd = new Date(o.trial_ends_at);

    // 7-day warning
    if (!o.trial_reminder_7d_at && trialEnd <= sevenDays && trialEnd > oneDay) {
      const adminEmails = await adminEmailsForOrg(supabase, o.id);
      for (const to of adminEmails) {
        await sendEmail({
          to,
          subject: `Your ${PLATFORM_NAME} trial ends in 7 days`,
          html: emailShell(
            `Your free trial ends in about 7 days`,
            `<p>You're currently on the ${tierSummary(o.subscription_tier)} plan as a free trial. To keep using ${o.name} on ${PLATFORM_NAME}, add a payment method before <strong>${trialEnd.toLocaleDateString()}</strong>.</p>`,
            `${appUrl}/settings`,
            "Add payment method",
          ),
        });
      }
      await supabase.from("organizations").update({ trial_reminder_7d_at: now.toISOString() }).eq("id", o.id);
      sent7d++;
    }

    // 1-day warning
    if (!o.trial_reminder_1d_at && trialEnd <= oneDay && trialEnd > now) {
      const adminEmails = await adminEmailsForOrg(supabase, o.id);
      for (const to of adminEmails) {
        await sendEmail({
          to,
          subject: `Your ${PLATFORM_NAME} trial ends tomorrow`,
          html: emailShell(
            `Trial ends ${trialEnd.toLocaleDateString()}`,
            `<p>Last call — your trial of the ${tierSummary(o.subscription_tier)} plan ends tomorrow. Subscribe today to keep ${o.name} active without interruption.</p>`,
            `${appUrl}/settings`,
            "Subscribe now",
          ),
        });
      }
      await supabase.from("organizations").update({ trial_reminder_1d_at: now.toISOString() }).eq("id", o.id);
      sent1d++;
    }

    // Expired — final email + flip status if not already
    if (!o.trial_expired_email_at && trialEnd <= now) {
      const adminEmails = await adminEmailsForOrg(supabase, o.id);
      for (const to of adminEmails) {
        await sendEmail({
          to,
          subject: `Your ${PLATFORM_NAME} trial has ended`,
          html: emailShell(
            `Trial ended — re-activate any time`,
            `<p>Your free trial of the ${tierSummary(o.subscription_tier)} plan has ended. Outbound messaging is paused until a plan is selected. Pick a plan to re-activate ${o.name} — no data is lost.</p>`,
            `${appUrl}/settings`,
            "Choose a plan",
          ),
        });
      }
      const patch: any = { trial_expired_email_at: now.toISOString() };
      if (!o.subscription_status || o.subscription_status === "trialing") {
        patch.subscription_status = "trial_expired";
        downgraded++;
      }
      await supabase.from("organizations").update(patch).eq("id", o.id);
      sentExpired++;
    }
  }

  return NextResponse.json({ ok: true, sent7d, sent1d, sentExpired, downgraded });
}
