// Subscription tiers + per-tier platform messaging quotas. Single source of
// truth — referenced by the senders for enforcement and the Settings panel
// for display. Stripe price IDs come from env so the operator can swap them
// per-environment without a code change.

export type Tier = "free" | "solo" | "pro";

export type TierConfig = {
  id: Tier;
  label: string;
  monthlyPrice: number; // USD
  emailPerMonth: number; // 0 = no platform email allowed
  smsPerMonth: number;  // 0 = no platform sms allowed
  byocAvailable: boolean;
  description: string;
  stripePriceEnvVar: string | null;
};

export const TIERS: Record<Tier, TierConfig> = {
  free: {
    id: "free",
    label: "Free",
    monthlyPrice: 0,
    emailPerMonth: 0,
    smsPerMonth: 0,
    byocAvailable: true,
    description: "Manual workflow only. Bring your own Resend / Telnyx if you want messaging.",
    stripePriceEnvVar: null,
  },
  solo: {
    id: "solo",
    label: "Solo",
    monthlyPrice: 20,
    emailPerMonth: 1000,
    smsPerMonth: 200,
    byocAvailable: true,
    description: "Everything plus 1,000 platform emails and 200 SMS messages per month.",
    stripePriceEnvVar: "STRIPE_PRICE_ID_SOLO",
  },
  pro: {
    id: "pro",
    label: "Pro",
    monthlyPrice: 49,
    emailPerMonth: 5000,
    smsPerMonth: 1000,
    byocAvailable: true,
    description: "Higher quotas and Stripe Connect (when shipped) for per-business payments.",
    stripePriceEnvVar: "STRIPE_PRICE_ID_PRO",
  },
};

export function tierFor(value: string | null | undefined): TierConfig {
  if (value === "pro") return TIERS.pro;
  if (value === "free") return TIERS.free;
  return TIERS.solo;
}

export function stripePriceIdFor(tier: Tier): string | null {
  const cfg = TIERS[tier];
  if (!cfg.stripePriceEnvVar) return null;
  return process.env[cfg.stripePriceEnvVar] ?? null;
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
};

function monthBoundsIso(): { startIso: string; endIso: string } {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

// Returns current-month send counts + quotas for an org. BYOC mode is
// reported alongside; quota enforcement skips it (the org is paying their
// own provider). Defensive: rolls null/missing rows to zero.
export async function getOrgUsage(organization_id: string): Promise<Usage> {
  const supabase = await createClient();
  const { startIso, endIso } = monthBoundsIso();

  const [{ data: org }, creds] = await Promise.all([
    supabase
      .from("organizations")
      .select("subscription_tier")
      .eq("id", organization_id)
      .single(),
    loadOrgMessagingCreds(organization_id),
  ]);

  const tier = tierFor((org as any)?.subscription_tier);
  const byoc = creds.mode === "byoc";

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
  };
}

// Returns true when the org may send another platform email/SMS this billing
// cycle. BYOC mode skips the quota — the org is on the hook for provider cost.
export async function canSend(
  organization_id: string,
  channel: "email" | "sms",
): Promise<{ ok: boolean; reason?: string }> {
  const usage = await getOrgUsage(organization_id);
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
