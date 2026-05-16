// Server-only billing helpers — getOrgUsage + canSend. Split from
// src/lib/billing.ts so client components can import the pure constants
// without dragging next/headers into the client bundle.

import { createClient } from "@/lib/supabase/server";
import { loadOrgMessagingCreds } from "@/lib/org-messaging";
import {
  PRO_ADDON_EMAIL_PER_PACK,
  PRO_ADDON_SMS_PER_PACK,
  type TierConfig,
  tierFor,
  trialStateFor,
  type TrialState,
} from "@/lib/billing";

export type Usage = {
  emailUsed: number;
  smsUsed: number;
  emailLimit: number; // total: tier base + addon packs
  smsLimit: number;   // total: tier base + addon packs
  emailBaseLimit: number;
  smsBaseLimit: number;
  quotaAddons: number;
  windowStartIso: string;
  windowEndIso: string;
  tier: TierConfig;
  byoc: boolean;
  trial: TrialState;
  subscriptionStatus: string | null;
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

export function hasActiveSubscription(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export async function canSend(
  organization_id: string,
  channel: "email" | "sms",
): Promise<{ ok: boolean; reason?: string }> {
  const usage = await getOrgUsage(organization_id);
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
