// Builds a Stripe Checkout session for the org's chosen plan + add-ons.
// Used both by the wizard's billing step (called from a server action) and
// the /api/billing/checkout POST route (called from any client-side form).

import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import {
  TIERS,
  TRIAL_DAYS,
  stripePriceIdFor,
  businessTypeAddonPriceId,
  proAddonPriceId,
  INCLUDED_BUSINESS_TYPES,
  type Tier,
} from "@/lib/billing";

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: "stripe_not_configured" | "tier_price_missing" | "no_org"; message?: string };

export async function createWizardCheckoutSession(opts: {
  organizationId: string;
  userId: string;
  origin: string;
}): Promise<CheckoutResult> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, reason: "stripe_not_configured" };

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("subscription_tier, stripe_customer_id, quota_addons, email, name")
    .eq("id", opts.organizationId)
    .maybeSingle();
  if (!org) return { ok: false, reason: "no_org" };

  const tier = ((org as any).subscription_tier as Tier) ?? "basic";
  const tierConfig = TIERS[tier] ?? TIERS.basic;
  const tierPriceId = stripePriceIdFor(tier);
  if (!tierPriceId) {
    return { ok: false, reason: "tier_price_missing", message: `Set ${tierConfig.stripePriceEnvVar} in env.` };
  }

  let customerId = (org as any).stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: ((org as any).email) ?? undefined,
      name: (org as any).name ?? undefined,
      metadata: { organization_id: opts.organizationId, owner_user_id: opts.userId },
    });
    customerId = customer.id;
    await supabase
      .from("organizations")
      .update({ stripe_customer_id: customerId } as any)
      .eq("id", opts.organizationId);
  }

  const { count: tradeCount } = await supabase
    .from("organization_business_types")
    .select("business_type_id", { count: "exact", head: true })
    .eq("organization_id", opts.organizationId);
  const extraTrades = Math.max(0, (tradeCount ?? 0) - INCLUDED_BUSINESS_TYPES);

  const line_items: { price: string; quantity: number }[] = [
    { price: tierPriceId, quantity: 1 },
  ];
  if (extraTrades > 0) {
    const tradeAddonPrice = businessTypeAddonPriceId();
    if (tradeAddonPrice) line_items.push({ price: tradeAddonPrice, quantity: extraTrades });
  }
  const proPacks = Math.max(0, Number((org as any).quota_addons ?? 0));
  if (tier === "pro" && proPacks > 0) {
    const packPrice = proAddonPriceId();
    if (packPrice) line_items.push({ price: packPrice, quantity: proPacks });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || opts.origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    payment_method_collection: "always",
    line_items,
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { organization_id: opts.organizationId, tier },
    },
    success_url: `${appUrl}/onboarding/billing/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/onboarding/billing?canceled=1`,
    client_reference_id: opts.organizationId,
    metadata: { organization_id: opts.organizationId, tier },
  });

  return { ok: true, url: session.url ?? `${appUrl}/onboarding/billing` };
}
