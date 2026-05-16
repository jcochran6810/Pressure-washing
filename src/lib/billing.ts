// SaaS subscription helpers. This is the layer where the platform (you)
// charges the pressure washing businesses for using the app — separate
// from Stripe Connect, which is where each business charges THEIR customers.

import { sendEmail } from "./email";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";

export type OrgBilling = {
  subscription_status: SubscriptionStatus | string | null;
  subscription_plan?: string | null;
  subscription_stripe_id?: string | null;
  subscription_customer_id?: string | null;
  subscription_current_period_end?: string | null;
  trial_ends_at?: string | null;
  past_due_since?: string | null;
};

// Active = trialing (still in trial window) OR active subscription.
export function isSubscriptionActive(org: OrgBilling | null | undefined): boolean {
  if (!org) return false;
  const s = org.subscription_status;
  if (s === "active") return true;
  if (s === "trialing") {
    const end = org.trial_ends_at ? new Date(org.trial_ends_at).getTime() : 0;
    return end > Date.now();
  }
  return false;
}

// Restricted = past_due or cancelled, OR trialing-but-trial-expired without subscribing.
export function isSubscriptionRestricted(org: OrgBilling | null | undefined): boolean {
  return !isSubscriptionActive(org);
}

export function daysLeftInTrial(org: OrgBilling | null | undefined): number | null {
  if (!org?.trial_ends_at) return null;
  if (org.subscription_status !== "trialing") return null;
  const ms = new Date(org.trial_ends_at).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// Banner copy + tone per state. UI consumes this.
export function subscriptionBanner(org: OrgBilling | null | undefined): {
  tone: "info" | "warning" | "error";
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
} | null {
  if (!org) return null;
  const status = org.subscription_status;

  if (status === "trialing") {
    const days = daysLeftInTrial(org);
    if (days === null) return null;
    if (days <= 0) {
      return {
        tone: "error",
        title: "Your trial has ended",
        body: "Add a payment method to keep sending estimates, invoices, and reminders. Your records remain accessible in the meantime.",
        ctaLabel: "Start subscription",
        ctaHref: "/billing",
      };
    }
    if (days <= 3) {
      return {
        tone: "warning",
        title: `${days} day${days === 1 ? "" : "s"} left in your free trial`,
        body: "Subscribe before the trial ends to avoid interruption.",
        ctaLabel: "Subscribe now",
        ctaHref: "/billing",
      };
    }
    // > 3 days left: quieter info banner only on /billing itself
    return null;
  }

  if (status === "past_due") {
    return {
      tone: "error",
      title: "Payment failed — action needed",
      body: "We couldn't charge your card. Update your payment method to resume sending estimates, invoices, and reminders. Your customer records are still accessible.",
      ctaLabel: "Update payment method",
      ctaHref: "/billing",
    };
  }

  if (status === "cancelled") {
    return {
      tone: "error",
      title: "Subscription cancelled",
      body: "Your subscription has been cancelled. Resubscribe any time to restore full access. Your records remain accessible.",
      ctaLabel: "Resubscribe",
      ctaHref: "/billing",
    };
  }

  return null;
}

// =====================================================================
// SaaS notification emails (platform → business owner)
// These are sent from the SaaS owner, not from the business's domain.
// Uses SAAS_EMAIL_FROM; falls back to RESEND_FROM.
// =====================================================================
async function sendSaasEmail(args: { to: string; subject: string; html: string }) {
  const originalFrom = process.env.RESEND_FROM;
  if (process.env.SAAS_EMAIL_FROM) {
    process.env.RESEND_FROM = process.env.SAAS_EMAIL_FROM;
  }
  try {
    return await sendEmail(args);
  } finally {
    if (originalFrom) process.env.RESEND_FROM = originalFrom;
  }
}

export async function emailPaymentFailed(opts: {
  to: string;
  orgName: string;
  ownerName?: string | null;
  amount?: string | null;
  appUrl: string;
}) {
  const billingUrl = `${opts.appUrl}/billing`;
  const subject = "Your Suds subscription payment didn't go through";
  const html = `<!doctype html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
      <h1 style="margin:0 0 12px;font-size:22px;">Payment couldn't be processed</h1>
      <p>Hi ${opts.ownerName || "there"},</p>
      <p>We tried to charge your card${opts.amount ? ` for ${opts.amount}` : ""} for your <strong>${opts.orgName}</strong> Suds subscription, but it didn't go through.</p>
      <p>Stripe will automatically retry over the next 21 days, but in the meantime your account is in <strong>limited mode</strong>:</p>
      <ul style="line-height:1.7;">
        <li>✓ Your customer records, jobs, invoices, and history stay fully accessible</li>
        <li>✗ Sending new estimates, invoices, receipts, SMS, and emails is paused</li>
        <li>✗ Generating new documents is paused</li>
      </ul>
      <p style="margin:24px 0;">Update your card now to restore full access immediately:</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${billingUrl}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;">Update payment method →</a>
      </p>
      <p style="color:#64748b;font-size:13px;">If the retry succeeds before you update, your access will restore automatically.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Need help? Reply to this email — a real person reads it.</p>
    </div>
  </body></html>`;
  return sendSaasEmail({ to: opts.to, subject, html });
}

export async function emailTrialEndingSoon(opts: {
  to: string;
  orgName: string;
  ownerName?: string | null;
  daysLeft: number;
  appUrl: string;
}) {
  const billingUrl = `${opts.appUrl}/billing`;
  const subject = `${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"} left in your Suds trial`;
  const html = `<!doctype html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
      <h1 style="margin:0 0 12px;font-size:22px;">Trial ending in ${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"}</h1>
      <p>Hi ${opts.ownerName || "there"},</p>
      <p>Your free trial of Suds (for ${opts.orgName}) ends in ${opts.daysLeft} day${opts.daysLeft === 1 ? "" : "s"}. To keep sending estimates, invoices, and reminders, add a payment method below.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${billingUrl}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;">Start subscription</a>
      </p>
      <p style="color:#64748b;font-size:13px;">If you don't subscribe, your account will switch to read-only — your records stay safe, you just won't be able to send new documents.</p>
    </div>
  </body></html>`;
  return sendSaasEmail({ to: opts.to, subject, html });
}

export async function emailSubscriptionRestored(opts: {
  to: string;
  orgName: string;
  ownerName?: string | null;
  appUrl: string;
}) {
  const subject = "Your Suds subscription is active again";
  const html = `<!doctype html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
      <h1 style="margin:0 0 12px;font-size:22px;color:#15803d;">You're all set ✓</h1>
      <p>Hi ${opts.ownerName || "there"},</p>
      <p>Your payment went through and ${opts.orgName} is back to full access. You can resume sending estimates, invoices, and reminders.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${opts.appUrl}/dashboard" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;">Open dashboard</a>
      </p>
    </div>
  </body></html>`;
  return sendSaasEmail({ to: opts.to, subject, html });
}
