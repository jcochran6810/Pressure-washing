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

// Multi-trade add-on. First N business types are included with every plan;
// each additional trade is a recurring monthly charge.
export const INCLUDED_BUSINESS_TYPES = 2;
export const BUSINESS_TYPE_ADDON_MONTHLY_PRICE = 3.99;
export const BUSINESS_TYPE_ADDON_PRICE_ENV_VAR = "STRIPE_PRICE_ID_BUSINESS_TYPE_ADDON";
export function businessTypeAddonPriceId(): string | null {
  return process.env[BUSINESS_TYPE_ADDON_PRICE_ENV_VAR] ?? null;
}
// Cost in USD for N total selected business types: 0 for the first INCLUDED_BUSINESS_TYPES,
// then BUSINESS_TYPE_ADDON_MONTHLY_PRICE per extra.
export function businessTypeAddonCost(totalTypes: number): number {
  const extras = Math.max(0, totalTypes - INCLUDED_BUSINESS_TYPES);
  return Number((extras * BUSINESS_TYPE_ADDON_MONTHLY_PRICE).toFixed(2));
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

