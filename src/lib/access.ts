// Unified access resolver. Single source of truth for "does this org have
// active access, and what tier?" — combines admin-granted comped access
// with Stripe subscription state with trial state. Every feature gate
// should call resolveOrgAccess() instead of reading subscription_status
// directly so a friend's comped Pro account works the same as a paying one.

import type { Tier } from "@/lib/billing";

export type AccessSource = "stripe" | "admin_grant" | "promo" | "internal";

export type AccessReason =
  | "comped"           // admin-granted free access
  | "trialing"         // inside trial window
  | "subscribed"       // Stripe subscription active
  | "past_due"         // Stripe sub is past_due — no access
  | "trial_expired"    // trial ended, no sub
  | "disabled"         // org.disabled_at set
  | "no_access";       // nothing else applies

export type OrgAccessRow = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  access_source?: string | null;
  comped_until?: string | null;
  trial_ends_at?: string | null;
  disabled_at?: string | null;
};

export type ResolvedAccess = {
  hasAccess: boolean;
  tier: Tier;
  reason: AccessReason;
  isComped: boolean;
  isPaid: boolean;
  isPastDue: boolean;
  isTrialing: boolean;
  expiresAt: string | null;
};

const PAID_STATUSES = new Set(["active", "trialing"]);

function normalizeTier(value: string | null | undefined): Tier {
  if (value === "pro" || value === "plus") return value;
  return "basic";
}

export function resolveOrgAccess(org: OrgAccessRow | null | undefined, now: Date = new Date()): ResolvedAccess {
  const tier = normalizeTier(org?.subscription_tier);

  if (!org) {
    return { hasAccess: false, tier, reason: "no_access", isComped: false, isPaid: false, isPastDue: false, isTrialing: false, expiresAt: null };
  }

  // Disabled orgs are always blocked, regardless of comped/paid state.
  if (org.disabled_at) {
    return { hasAccess: false, tier, reason: "disabled", isComped: false, isPaid: false, isPastDue: false, isTrialing: false, expiresAt: null };
  }

  // Comped access wins over Stripe. Friends/beta/etc.
  const isCompedSource = org.access_source === "admin_grant" || org.access_source === "promo" || org.access_source === "internal";
  if (isCompedSource) {
    const ends = org.comped_until ? new Date(org.comped_until) : null;
    const stillValid = !ends || ends > now;
    if (stillValid) {
      return {
        hasAccess: true,
        tier,
        reason: "comped",
        isComped: true,
        isPaid: false,
        isPastDue: false,
        isTrialing: false,
        expiresAt: org.comped_until ?? null,
      };
    }
  }

  // Trial window (10-day free trial set at signup).
  const trialEndsAt = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
  if (trialEndsAt && trialEndsAt > now) {
    return {
      hasAccess: true,
      tier,
      reason: "trialing",
      isComped: false,
      isPaid: false,
      isPastDue: false,
      isTrialing: true,
      expiresAt: org.trial_ends_at ?? null,
    };
  }

  // Stripe subscription.
  if (PAID_STATUSES.has(org.subscription_status ?? "")) {
    return {
      hasAccess: true,
      tier,
      reason: "subscribed",
      isComped: false,
      isPaid: true,
      isPastDue: false,
      isTrialing: false,
      expiresAt: null,
    };
  }
  if (org.subscription_status === "past_due") {
    return {
      hasAccess: false,
      tier,
      reason: "past_due",
      isComped: false,
      isPaid: true,
      isPastDue: true,
      isTrialing: false,
      expiresAt: null,
    };
  }
  if (org.subscription_status === "trial_expired") {
    return {
      hasAccess: false,
      tier,
      reason: "trial_expired",
      isComped: false,
      isPaid: false,
      isPastDue: false,
      isTrialing: false,
      expiresAt: null,
    };
  }

  return {
    hasAccess: false,
    tier,
    reason: "no_access",
    isComped: false,
    isPaid: false,
    isPastDue: false,
    isTrialing: false,
    expiresAt: null,
  };
}

export function accessLabel(r: ResolvedAccess): string {
  switch (r.reason) {
    case "comped": return r.expiresAt ? `Free access until ${new Date(r.expiresAt).toLocaleDateString()}` : "Free access granted";
    case "trialing": return "Free trial";
    case "subscribed": return "Subscribed";
    case "past_due": return "Payment past due";
    case "trial_expired": return "Trial ended";
    case "disabled": return "Account disabled";
    default: return "No active access";
  }
}
