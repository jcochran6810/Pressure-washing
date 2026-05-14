// Subscription tiers + per-tier feature config. Single source of truth —
// referenced by the senders for quota enforcement, Stripe checkout for the
// trial-period flag, and the Settings panel for display. Stripe price IDs
// come from env so the operator can swap them per-environment.

export type Tier = "basic" | "plus" | "pro";

export const TRIAL_DAYS = 10;

export type TierConfig = {
  id: Tier;
  label: string;
  monthlyPrice: number; // USD
  emailPerMonth: number;
  smsPerMonth: number;
  byocAvailable: boolean;
  seats: number; // 0 = unlimited
  automatedReviews: boolean;
  customBranding: boolean;
  prioritySupport: boolean;
  description: string;
  features: string[]; // marketing-style bullets shown on the plan card
  stripePriceEnvVar: string | null;
};

export const TIERS: Record<Tier, TierConfig> = {
  basic: {
    id: "basic",
    label: "Basic",
    monthlyPrice: 5,
    emailPerMonth: 200,
    smsPerMonth: 50,
    byocAvailable: false,
    seats: 1,
    automatedReviews: false,
    customBranding: false,
    prioritySupport: false,
    description: "The essentials for a solo operator getting started.",
    features: [
      "1 user seat",
      "200 platform emails / month",
      "50 SMS messages / month",
      "Estimates, invoices & job scheduling",
      "Email support",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_ID_BASIC",
  },
  plus: {
    id: "plus",
    label: "Plus",
    monthlyPrice: 15,
    emailPerMonth: 1500,
    smsPerMonth: 300,
    byocAvailable: true,
    seats: 3,
    automatedReviews: true,
    customBranding: true,
    prioritySupport: false,
    description: "Growing crews who need automation and bigger send volume.",
    features: [
      "Up to 3 user seats",
      "1,500 platform emails / month",
      "300 SMS messages / month",
      "Automated review requests",
      "Custom branding on documents",
      "Bring-your-own email & SMS keys",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_ID_PLUS",
  },
  pro: {
    id: "pro",
    label: "Pro",
    monthlyPrice: 45,
    emailPerMonth: 5000,
    smsPerMonth: 1000,
    byocAvailable: true,
    seats: 0,
    automatedReviews: true,
    customBranding: true,
    prioritySupport: true,
    description: "High-volume teams that need every feature and headroom to grow.",
    features: [
      "Unlimited user seats",
      "5,000 platform emails / month",
      "1,000 SMS messages / month",
      "Automated review requests",
      "Custom branding on documents",
      "Bring-your-own email & SMS keys",
      "Stripe Connect for per-business payments",
      "Priority support",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_ID_PRO",
  },
};

export const TIER_ORDER: Tier[] = ["basic", "plus", "pro"];

export function tierFor(value: string | null | undefined): TierConfig {
  if (value === "pro") return TIERS.pro;
  if (value === "plus") return TIERS.plus;
  return TIERS.basic;
}

export function stripePriceIdFor(tier: Tier): string | null {
  const cfg = TIERS[tier];
  if (!cfg.stripePriceEnvVar) return null;
  return process.env[cfg.stripePriceEnvVar] ?? null;
}

// Trial helpers. The DB column trial_ends_at is the source of truth; this
// just centralizes the "is it still active / how long left" math.
export type TrialState = {
  active: boolean;
  endsAt: Date | null;
  daysRemaining: number;
};

export function trialStateFor(trialEndsAt: string | Date | null | undefined): TrialState {
  if (!trialEndsAt) return { active: false, endsAt: null, daysRemaining: 0 };
  const ends = trialEndsAt instanceof Date ? trialEndsAt : new Date(trialEndsAt);
  if (Number.isNaN(ends.getTime())) return { active: false, endsAt: null, daysRemaining: 0 };
  const msLeft = ends.getTime() - Date.now();
  return {
    active: msLeft > 0,
    endsAt: ends,
    daysRemaining: Math.max(0, Math.ceil(msLeft / 86_400_000)),
  };
}

import { createClient } from "@/lib/supabase/server";
import { loadOrgMessagingCreds } from "@/lib/org-messaging";

export type Usage = {
  emailUsed: number;
  smsUsed: number;
  emailLimit: number;
  smsLimit: number;
  windowStartIso: string;
  windowEndIso: string;
  tier: TierConfig;
  byoc: boolean;
  trial: TrialState;
  subscriptionStatus: string | null;
};

function monthBoundsIso(): { startIso: string; endIso: string } {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export async function getOrgUsage(organization_id: string): Promise<Usage> {
  const supabase = await createClient();
  const { startIso, endIso } = monthBoundsIso();

  const [{ data: org }, creds] = await Promise.all([
    supabase
      .from("organizations")
      .select("subscription_tier, subscription_status, trial_ends_at")
      .eq("id", organization_id)
      .single(),
    loadOrgMessagingCreds(organization_id),
  ]);

  const tier = tierFor((org as any)?.subscription_tier);
  const byoc = creds.mode === "byoc";
  const trial = trialStateFor((org as any)?.trial_ends_at);
  const subscriptionStatus = (org as any)?.subscription_status ?? null;

  const [emailRes, smsRes] = await Promise.all([
    (supabase as any)
      .from("email_log")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization_id)
      .gte("sent_at", startIso)
      .lt("sent_at", endIso),
    (supabase as any)
      .from("sms_log")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organization_id)
      .gte("sent_at", startIso)
      .lt("sent_at", endIso),
  ]);

  return {
    emailUsed: emailRes?.count ?? 0,
    smsUsed: smsRes?.count ?? 0,
    emailLimit: tier.emailPerMonth,
    smsLimit: tier.smsPerMonth,
    windowStartIso: startIso,
    windowEndIso: endIso,
    tier,
    byoc,
    trial,
    subscriptionStatus,
  };
}

// Org has paid access (i.e. should bypass the post-trial paywall) when its
// Stripe subscription is in an active / trialing state.
export function hasActiveSubscription(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

// Returns true when the org may send another platform email/SMS this billing
// cycle. BYOC mode skips the quota. After trial expires and with no active
// sub, all sends are blocked regardless of tier quota.
export async function canSend(
  organization_id: string,
  channel: "email" | "sms",
): Promise<{ ok: boolean; reason?: string }> {
  const usage = await getOrgUsage(organization_id);
  if (!usage.trial.active && !hasActiveSubscription(usage.subscriptionStatus)) {
    return {
      ok: false,
      reason: "Your free trial has ended. Choose a plan in Settings to keep sending.",
    };
  }
  if (usage.byoc) return { ok: true };
  const limit = channel === "email" ? usage.emailLimit : usage.smsLimit;
  const used = channel === "email" ? usage.emailUsed : usage.smsUsed;
  if (limit <= 0) {
    return {
      ok: false,
      reason: `Your ${usage.tier.label} plan doesn't include platform ${channel}. Upgrade or switch to BYOC.`,
    };
  }
  if (used >= limit) {
    return {
      ok: false,
      reason: `Monthly ${channel} quota reached (${used}/${limit}). Upgrade for more.`,
    };
  }
  return { ok: true };
}
