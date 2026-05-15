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
    emailPerMonth: 0,
    smsPerMonth: 0,
    byocAvailable: false,
    seats: 1,
    automatedReviews: false,
    customBranding: false,
    prioritySupport: false,
    description: "The essentials for a solo operator getting started.",
    features: [
      "1 user seat",
      "Estimates, invoices & job scheduling",
      "Customer & property records",
      "Email support",
      "No included email or SMS (upgrade to Plus to send messages)",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_ID_BASIC",
  },
  plus: {
    id: "plus",
    label: "Plus",
    monthlyPrice: 15,
    emailPerMonth: 200,
    smsPerMonth: 100,
    byocAvailable: false,
    seats: 3,
    automatedReviews: true,
    customBranding: true,
    prioritySupport: false,
    description: "Growing crews who need automation and outbound messaging.",
    features: [
      "Up to 3 user seats",
      "200 platform emails / month",
      "100 SMS messages / month",
      "Automated review requests",
      "Custom branding on documents",
      "Upgrade to Pro for higher send volume",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_ID_PLUS",
  },
  pro: {
    id: "pro",
    label: "Pro",
    monthlyPrice: 45,
    emailPerMonth: 1500,
    smsPerMonth: 750,
    byocAvailable: true,
    seats: 0,
    automatedReviews: true,
    customBranding: true,
    prioritySupport: true,
    description: "High-volume teams that need every feature and headroom to grow.",
    features: [
      "Unlimited user seats",
      "1,500 platform emails / month",
      "750 SMS messages / month",
      "Automated review requests",
      "Custom branding on documents",
      "Bring-your-own email & SMS keys",
      "Stripe Connect for per-business payments",
      "Priority support",
      "Add quota packs for +5,000 emails & +1,500 SMS each",
    ],
    stripePriceEnvVar: "STRIPE_PRICE_ID_PRO",
  },
};

// Pro-tier add-on. Each pack adds this much capacity on top of the Pro base.
export const PRO_ADDON_EMAIL_PER_PACK = 5000;
export const PRO_ADDON_SMS_PER_PACK = 1500;
export const PRO_ADDON_PRICE_ENV_VAR = "STRIPE_PRICE_ID_PRO_ADDON";
export function proAddonPriceId(): string | null {
  return process.env[PRO_ADDON_PRICE_ENV_VAR] ?? null;
}

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
  emailLimit: number; // total: tier base + addon packs
  smsLimit: number;   // total: tier base + addon packs
  emailBaseLimit: number; // tier-only base, no addons
  smsBaseLimit: number;
  quotaAddons: number; // how many add-on packs the org has
  windowStartIso: string;
  windowEndIso: string;
  tier: TierConfig;
  byoc: boolean;
  trial: TrialState;
  subscriptionStatus: string | null;
  // Raw org row fields needed by the access resolver (comped state, disabled, etc.)
  orgRaw: {
    subscription_tier: string | null;
    subscription_status: string | null;
    access_source: string | null;
    comped_until: string | null;
    trial_ends_at: string | null;
    disabled_at: string | null;
  };
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
      .select("subscription_tier, subscription_status, trial_ends_at, quota_addons, access_source, comped_until, disabled_at")
      .eq("id", organization_id)
      .single(),
    loadOrgMessagingCreds(organization_id),
  ]);

  const tier = tierFor((org as any)?.subscription_tier);
  const byoc = creds.mode === "byoc";
  const trial = trialStateFor((org as any)?.trial_ends_at);
  const subscriptionStatus = (org as any)?.subscription_status ?? null;
  // Addons only stack on Pro. Defensive — older rows may have NULL.
  const quotaAddons = tier.id === "pro" ? Math.max(0, Number((org as any)?.quota_addons ?? 0)) : 0;
  const emailLimit = tier.emailPerMonth + quotaAddons * PRO_ADDON_EMAIL_PER_PACK;
  const smsLimit = tier.smsPerMonth + quotaAddons * PRO_ADDON_SMS_PER_PACK;

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
    emailLimit,
    smsLimit,
    emailBaseLimit: tier.emailPerMonth,
    smsBaseLimit: tier.smsPerMonth,
    quotaAddons,
    windowStartIso: startIso,
    windowEndIso: endIso,
    tier,
    byoc,
    trial,
    subscriptionStatus,
    orgRaw: {
      subscription_tier: (org as any)?.subscription_tier ?? null,
      subscription_status: subscriptionStatus,
      access_source: (org as any)?.access_source ?? null,
      comped_until: (org as any)?.comped_until ?? null,
      trial_ends_at: (org as any)?.trial_ends_at ?? null,
      disabled_at: (org as any)?.disabled_at ?? null,
    },
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
  // Comped orgs bypass the trial / subscription paywall entirely — the
  // resolver decides. canSend still enforces the channel/quota rules below.
  const { resolveOrgAccess } = await import("@/lib/access");
  const access = resolveOrgAccess(usage.orgRaw);
  if (!access.hasAccess) {
    const reason =
      access.reason === "disabled" ? "This account has been disabled." :
      access.reason === "past_due" ? "Payment is past due. Update billing to resume sending." :
      access.reason === "trial_expired" ? "Your free trial has ended. Choose a plan in Settings to keep sending." :
      "No active subscription. Choose a plan in Settings to keep sending.";
    return { ok: false, reason };
  }
  if (usage.byoc) return { ok: true };
  const limit = channel === "email" ? usage.emailLimit : usage.smsLimit;
  const used = channel === "email" ? usage.emailUsed : usage.smsUsed;
  if (limit <= 0) {
    const next = usage.tier.id === "basic" ? "Upgrade to Plus" : "Upgrade";
    return {
      ok: false,
      reason: `Your ${usage.tier.label} plan doesn't include platform ${channel}. ${next} to start sending.`,
    };
  }
  if (used >= limit) {
    const next =
      usage.tier.id === "pro"
        ? "Add a Pro quota pack for more capacity."
        : usage.tier.id === "plus"
          ? "Upgrade to Pro for higher monthly limits."
          : "Upgrade for more.";
    return {
      ok: false,
      reason: `Monthly ${channel} quota reached (${used}/${limit}). ${next}`,
    };
  }
  return { ok: true };
}
