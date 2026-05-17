"use server";

// IMPORTANT: this file uses getSessionAndOrg (NOT getSessionAndOrgForMutation)
// on purpose — billing actions must work even when the subscription is
// past-due, otherwise the user has no way to fix it.

import { getSessionAndOrg } from "@/lib/org";
import { getStripe } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// =====================================================================
// Subscription pricing — adjust to match your offering.
// Easiest path: pre-create a Price in your Stripe Dashboard and set
// STRIPE_SUBSCRIPTION_PRICE_ID. Falls back to creating one on the fly.
// =====================================================================
const FALLBACK_AMOUNT_USD = 49; // $49/mo if you haven't set the env var

// Resolve the Stripe price ID for the given plan slug. Order of precedence:
//  1. subscription_plans.stripe_price_id_monthly column (admin set in /admin/plans)
//  2. STRIPE_SUBSCRIPTION_PRICE_ID env var (legacy)
//  3. lazily create a product+price using the slug's stored amount
async function getSubscriptionPriceId(stripe: any, supabase: any, slug: string): Promise<{ priceId: string; planName: string }> {
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("name, monthly_amount, stripe_price_id_monthly")
    .eq("slug", slug)
    .maybeSingle();

  if (plan?.stripe_price_id_monthly) return { priceId: plan.stripe_price_id_monthly, planName: plan.name };
  if (process.env.STRIPE_SUBSCRIPTION_PRICE_ID) return { priceId: process.env.STRIPE_SUBSCRIPTION_PRICE_ID, planName: plan?.name ?? "Starter" };

  const amount = Number(plan?.monthly_amount ?? FALLBACK_AMOUNT_USD);
  const product = await stripe.products.create({
    name: `Suds — ${plan?.name ?? "Starter"}`,
    description: "Monthly subscription",
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: Math.round(amount * 100),
    recurring: { interval: "month" },
  });
  // Cache the created price ID on the plan row so we don't keep making products.
  if (plan) {
    await supabase.from("subscription_plans").update({ stripe_price_id_monthly: price.id }).eq("slug", slug);
  }
  return { priceId: price.id, planName: plan?.name ?? "Starter" };
}

// =====================================================================
// Start (or resume) a SaaS subscription. Creates a Stripe Checkout
// session in subscription mode. The webhook records the subscription
// ID when checkout completes.
// =====================================================================
export async function startSubscription(planSlug?: string) {
  const { supabase, organizationId, organization, user } = await getSessionAndOrg();
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured.");
  if (!user.email) throw new Error("Your account has no email address.");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const slug = planSlug || (organization as any)?.subscription_plan || "starter";

  // Reuse the Stripe customer if we already have one (e.g. resubscribing
  // after cancellation).
  let customerId = (organization as any)?.subscription_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: organization?.name || user.email,
      metadata: { organization_id: organizationId },
    });
    customerId = customer.id;
    await supabase.from("organizations").update({
      subscription_customer_id: customerId,
    }).eq("id", organizationId);
  }

  const { priceId, planName } = await getSubscriptionPriceId(stripe, supabase, slug);

  // Card required at signup. We still want the 14-day trial — Stripe gives us
  // both via trial_period_days + the payment_method_collection requirement.
  // The customer's card is held but not charged until the trial ends; on day 14
  // Stripe auto-charges and the monthly billing day = trial-end day.
  const remainingTrialDays = computeRemainingTrialDays((organization as any)?.trial_ends_at, (organization as any)?.subscription_status);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    payment_method_collection: "always", // require card upfront
    success_url: `${appUrl}/billing?subscription=ok`,
    cancel_url: `${appUrl}/billing?subscription=cancelled`,
    metadata: {
      saas_subscription: "1",
      organization_id: organizationId,
      plan_slug: slug,
    },
    subscription_data: {
      trial_period_days: remainingTrialDays > 0 ? remainingTrialDays : undefined,
      metadata: {
        saas_subscription: "1",
        organization_id: organizationId,
        plan_slug: slug,
      },
    },
  });

  // Store which plan they're on (will be confirmed by the webhook)
  await supabase.from("organizations").update({ subscription_plan: slug }).eq("id", organizationId);

  await logAudit({
    organizationId,
    action: "create",
    entityType: "subscription",
    entityLabel: `Started checkout for ${planName}`,
    after: { checkout_session_id: session.id, plan_slug: slug },
  });

  return { checkoutUrl: session.url };
}

// Compute remaining days of trial. Used so existing trial users who only just
// add a card aren't given a fresh 14 days on top of what they already used.
function computeRemainingTrialDays(trialEndsAt: string | null, status: string | null): number {
  if (status !== "trialing" || !trialEndsAt) return 0;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// =====================================================================
// Open the Stripe Customer Portal so the user can update their payment
// method, view invoices, or cancel — all hosted by Stripe.
// =====================================================================
export async function openCustomerPortal() {
  const { organization, organizationId } = await getSessionAndOrg();
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured.");
  const customerId = (organization as any)?.subscription_customer_id as string | null;
  if (!customerId) throw new Error("No Stripe customer yet — start a subscription first.");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/billing`,
  });
  await logAudit({
    organizationId,
    action: "update",
    entityType: "subscription",
    entityLabel: "Opened customer portal",
  });
  return { url: portal.url };
}

// =====================================================================
// Cancel at period end (graceful — user keeps access until the period ends).
// =====================================================================
export async function cancelSubscriptionAtPeriodEnd() {
  const { supabase, organization, organizationId } = await getSessionAndOrg();
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured.");
  const subId = (organization as any)?.subscription_stripe_id as string | null;
  if (!subId) throw new Error("No active subscription.");

  await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
  await logAudit({
    organizationId,
    action: "void",
    entityType: "subscription",
    entityLabel: "Cancellation scheduled at period end",
  });
  revalidatePath("/billing");
}

export async function resumeSubscription() {
  const { supabase, organization, organizationId } = await getSessionAndOrg();
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured.");
  const subId = (organization as any)?.subscription_stripe_id as string | null;
  if (!subId) throw new Error("No subscription to resume.");

  await stripe.subscriptions.update(subId, { cancel_at_period_end: false });
  await logAudit({
    organizationId,
    action: "update",
    entityType: "subscription",
    entityLabel: "Cancellation undone",
  });
  revalidatePath("/billing");
}
