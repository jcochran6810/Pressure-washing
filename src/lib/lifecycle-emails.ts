// Lifecycle email templates — used both at signup time (auth callback)
// and by the daily cron as a backstop.

import { BRAND } from "./brand";

function shell(body: string) {
  return `<!doctype html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
      ${body}
    </div>
  </body>`;
}

export function welcomeEmail(opts: { orgName: string; appUrl: string }) {
  return {
    subject: `Welcome to ${BRAND.name} — let's get you set up`,
    html: shell(`
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
        <a href="${opts.appUrl}/dashboard" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;">Open dashboard</a>
      </p>
      <p style="color:#64748b;font-size:13px;">Reply directly to this email if you get stuck — a real person reads every message.</p>
    `),
  };
}

export function day3CheckInEmail(opts: { orgName: string; appUrl: string }) {
  return {
    subject: `How's it going with ${BRAND.name}?`,
    html: shell(`
      <h1 style="margin:0 0 12px;font-size:22px;">How's it going?</h1>
      <p>You've been on ${BRAND.name} for 3 days. Quick check-in:</p>
      <p><strong>Got a first estimate out?</strong> If yes, awesome — try the auto-invoice flow next (mark a job completed and watch the invoice draft itself).</p>
      <p><strong>Stuck on setup?</strong> Hit reply with the question and I'll get you unstuck. Most common holdups:</p>
      <ul>
        <li><strong>Stripe Connect</strong> — onboarding takes 5 min but Stripe sometimes holds new accounts for review. Patience is fine.</li>
        <li><strong>SMS isn't sending</strong> — US carriers require 10DLC registration in Telnyx first. Walkthrough in <a href="${opts.appUrl}/help">Help</a>.</li>
        <li><strong>Email landing in spam</strong> — verify your sending domain in Resend.</li>
      </ul>
      <p style="text-align:center;margin:24px 0;">
        <a href="${opts.appUrl}/dashboard" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;">Open dashboard</a>
      </p>
    `),
  };
}

export function dataDeletionWarningEmail(opts: {
  orgName: string;
  appUrl: string;
  deletionAt: string;
}) {
  const date = new Date(opts.deletionAt).toLocaleDateString();
  return {
    subject: `Your ${BRAND.name} data will be deleted on ${date}`,
    html: shell(`
      <h1 style="margin:0 0 12px;font-size:22px;color:#b45309;">Your data will be deleted on ${date}</h1>
      <p>Hi,</p>
      <p>Your ${BRAND.name} subscription for <strong>${opts.orgName}</strong> was cancelled, and the 90-day retention window ends on <strong>${date}</strong>. After that date, your customer records, jobs, invoices, photos, and other data will be permanently deleted.</p>
      <p><strong>Two options before then:</strong></p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${opts.appUrl}/api/account/export" style="display:inline-block;padding:14px 28px;background:#0f766e;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;margin:4px;">Download my data now →</a>
      </p>
      <p style="text-align:center;">
        <a href="${opts.appUrl}/billing" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;margin:4px;">Resubscribe to keep everything →</a>
      </p>
      <p style="color:#64748b;font-size:13px;margin-top:24px;">If you don't take action, deletion will happen automatically on ${date} and cannot be undone after that point.</p>
    `),
  };
}

export function priceChangeEmail(opts: {
  orgName: string;
  appUrl: string;
  oldAmount: string;
  newAmount: string;
  effectiveDate: string;
  customMessage?: string;
}) {
  return {
    subject: `${BRAND.name} pricing update — effective ${opts.effectiveDate}`,
    html: shell(`
      <h1 style="margin:0 0 12px;font-size:22px;">An update to your ${BRAND.name} subscription</h1>
      <p>Hi from ${BRAND.name},</p>
      <p>Starting <strong>${opts.effectiveDate}</strong>, your monthly subscription will change from <strong>${opts.oldAmount}</strong> to <strong>${opts.newAmount}</strong>.</p>
      ${opts.customMessage ? `<div style="margin:16px 0;padding:16px;background:#f8fafc;border-left:4px solid #2563eb;border-radius:4px;">${opts.customMessage}</div>` : ""}
      <p>What you can do:</p>
      <ul>
        <li><strong>Keep your subscription</strong> — no action needed. The new rate kicks in on your next billing cycle on or after ${opts.effectiveDate}.</li>
        <li><strong>Cancel before the effective date</strong> — open <a href="${opts.appUrl}/billing">Billing</a> any time. You keep access through your current period.</li>
      </ul>
      <p style="color:#64748b;font-size:13px;margin-top:24px;">Questions? Reply to this email and we'll respond promptly.</p>
    `),
  };
}
