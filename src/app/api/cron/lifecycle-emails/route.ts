// Lifecycle emails — runs daily.
// Sends:
//   1. Welcome email (day 0 — backstop in case the signup-time send failed)
//   2. Onboarding check-in (day 3)
//   3. Trial-ending warning (day 10 — 4 days left)
//   4. Trial-ending-tomorrow (day 13 — 1 day left)
//   5. Pre-deletion warning (7 days before data is purged)
//
// All sends are idempotent — each milestone has a `*_email_sent_at` column.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendEmail } from "@/lib/email";
import { emailTrialEndingSoon } from "@/lib/billing";
import { BRAND } from "@/lib/brand";

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
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handler(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Helper to find orgs at a specific signup-age in days
  async function orgsAtAge(days: number, column: string) {
    const from = new Date(); from.setDate(from.getDate() - days); from.setHours(0, 0, 0, 0);
    const to = new Date(from); to.setHours(23, 59, 59, 999);
    const { data } = await supabase
      .from("organizations")
      .select("id, name, email, created_at, trial_ends_at")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .is(column as any, null)
      .in("subscription_status", ["trialing", "active"]);
    return data ?? [];
  }

  let welcomeSent = 0, day3Sent = 0, day10Sent = 0, day13Sent = 0, warnSent = 0;

  // Day 0 — welcome (backstop if signup-time send failed)
  for (const org of await orgsAtAge(0, "welcome_email_sent_at")) {
    if (!org.email) continue;
    await sendEmail({
      to: org.email,
      subject: `Welcome to ${BRAND.name} — let's get you set up`,
      html: welcomeHtml(org.name, appUrl),
    });
    await supabase.from("organizations").update({ welcome_email_sent_at: new Date().toISOString() }).eq("id", org.id);
    welcomeSent++;
  }

  // Day 3 — check-in
  for (const org of await orgsAtAge(3, "onboarding_day3_email_sent_at")) {
    if (!org.email) continue;
    await sendEmail({
      to: org.email,
      subject: `How's it going with ${BRAND.name}?`,
      html: day3Html(org.name, appUrl),
    });
    await supabase.from("organizations").update({ onboarding_day3_email_sent_at: new Date().toISOString() }).eq("id", org.id);
    day3Sent++;
  }

  // Day 10 — trial ending in 4 days
  for (const org of await orgsAtAge(10, "onboarding_day10_email_sent_at")) {
    if (!org.email) continue;
    await emailTrialEndingSoon({
      to: org.email,
      orgName: org.name,
      daysLeft: 4,
      appUrl,
    });
    await supabase.from("organizations").update({ onboarding_day10_email_sent_at: new Date().toISOString() }).eq("id", org.id);
    day10Sent++;
  }

  // Day 13 — trial ending tomorrow
  for (const org of await orgsAtAge(13, "onboarding_day13_email_sent_at")) {
    if (!org.email) continue;
    await emailTrialEndingSoon({
      to: org.email,
      orgName: org.name,
      daysLeft: 1,
      appUrl,
    });
    await supabase.from("organizations").update({ onboarding_day13_email_sent_at: new Date().toISOString() }).eq("id", org.id);
    day13Sent++;
  }

  // Pre-deletion warning: cancelled orgs whose scheduled deletion is within 7 days
  const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const { data: pending } = await supabase
    .from("organizations")
    .select("id, name, email, data_deletion_scheduled_at")
    .eq("subscription_status", "cancelled")
    .not("data_deletion_scheduled_at", "is", null)
    .lte("data_deletion_scheduled_at", sevenDays.toISOString())
    .is("data_deletion_warned_at", null);

  for (const org of pending ?? []) {
    if (!org.email) continue;
    const exportUrl = `${appUrl}/api/account/export`;
    const restoreUrl = `${appUrl}/billing`;
    await sendEmail({
      to: org.email,
      subject: `Your ${BRAND.name} data will be deleted in 7 days`,
      html: dataDeletionHtml(org.name, exportUrl, restoreUrl, org.data_deletion_scheduled_at!),
    });
    await supabase.from("organizations").update({ data_deletion_warned_at: new Date().toISOString() }).eq("id", org.id);
    warnSent++;
  }

  return NextResponse.json({
    welcome_sent: welcomeSent,
    day3_sent: day3Sent,
    day10_sent: day10Sent,
    day13_sent: day13Sent,
    deletion_warnings_sent: warnSent,
  });
}

export const GET = handler;
export const POST = handler;

// ============ Email templates ============

function shell(body: string) {
  return `<!doctype html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
      ${body}
    </div>
  </body>`;
}

function welcomeHtml(orgName: string, appUrl: string) {
  return shell(`
    <h1 style="margin:0 0 12px;font-size:22px;">Welcome to ${BRAND.name} 🎉</h1>
    <p>Hi from ${BRAND.name}, your ${BRAND.tagline.toLowerCase()}.</p>
    <p>You've got a 14-day free trial — full access, no credit card required. Here's the fastest path to your first invoice sent:</p>
    <ol style="line-height:1.8;">
      <li><strong>Settings</strong> → add your business info, address, and tax rate.</li>
      <li><strong>Customers → New</strong> → add a first customer.</li>
      <li><strong>Estimates → New</strong> → quote them.</li>
      <li><strong>Send</strong> the estimate via email. Customer can approve with one click.</li>
      <li>Done — the job is scheduled and the invoice drafts itself when complete.</li>
    </ol>
    <p style="text-align:center;margin:24px 0;">
      <a href="${appUrl}/dashboard" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;">Open dashboard</a>
    </p>
    <p style="color:#64748b;font-size:13px;">Reply directly to this email if you get stuck — a real person reads every message.</p>
  `);
}

function day3Html(orgName: string, appUrl: string) {
  return shell(`
    <h1 style="margin:0 0 12px;font-size:22px;">How's it going?</h1>
    <p>You've been on ${BRAND.name} for 3 days. Quick check-in:</p>
    <p><strong>Got a first estimate out?</strong> If yes, awesome — try the auto-invoice flow next (mark a job completed and watch the invoice draft itself).</p>
    <p><strong>Stuck on setup?</strong> Hit reply with the question and I'll get you unstuck. Most common holdups:</p>
    <ul>
      <li><strong>Stripe Connect</strong> — onboarding takes 5 min but Stripe sometimes holds new accounts for review. Patient is fine.</li>
      <li><strong>SMS isn't sending</strong> — US carriers require 10DLC registration in Telnyx first. Walkthrough in <a href="${appUrl}/help">Help</a>.</li>
      <li><strong>Email landing in spam</strong> — verify your sending domain in Resend.</li>
    </ul>
    <p style="text-align:center;margin:24px 0;">
      <a href="${appUrl}/dashboard" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;">Open dashboard</a>
    </p>
  `);
}

function dataDeletionHtml(orgName: string, exportUrl: string, restoreUrl: string, deletionAt: string) {
  const date = new Date(deletionAt).toLocaleDateString();
  return shell(`
    <h1 style="margin:0 0 12px;font-size:22px;color:#b45309;">Your data will be deleted on ${date}</h1>
    <p>Hi,</p>
    <p>Your ${BRAND.name} subscription for <strong>${orgName}</strong> was cancelled, and the 90-day retention window ends on <strong>${date}</strong>. After that date, your customer records, jobs, invoices, photos, and other data will be permanently deleted.</p>
    <p><strong>Two options before then:</strong></p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${exportUrl}" style="display:inline-block;padding:14px 28px;background:#0f766e;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;margin:4px;">Download my data now →</a>
    </p>
    <p style="text-align:center;">
      <a href="${restoreUrl}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;margin:4px;">Resubscribe to keep everything →</a>
    </p>
    <p style="color:#64748b;font-size:13px;margin-top:24px;">If you don't take action, deletion will happen automatically on ${date} and cannot be undone after that point.</p>
  `);
}
