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

async function getSubscriptionPriceId(stripe: any): Promise<string> {
  if (process.env.STRIPE_SUBSCRIPTION_PRICE_ID) {
    return process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
  }
  // Lazy create a product + price the first time. Production should set the env var.
  const product = await stripe.products.create({
    name: "Suds — Pressure Washing Business Manager",
    description: "Monthly subscription",
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: FALLBACK_AMOUNT_USD * 100,
    recurring: { interval: "month" },
  });
  return price.id;
}

// =====================================================================
// Start (or resume) a SaaS subscription. Creates a Stripe Checkout
// session in subscription mode. The webhook records the subscription
// ID when checkout completes.
// =====================================================================
export async function startSubscription() {
  const { supabase, organizationId, organization, user } = await getSessionAndOrg();
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured.");
  if (!user.email) throw new Error("Your account has no email address.");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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

  const priceId = await getSubscriptionPriceId(stripe);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/billing?subscription=ok`,
    cancel_url: `${appUrl}/billing?subscription=cancelled`,
    metadata: {
      saas_subscription: "1",
      organization_id: organizationId,
    },
    subscription_data: {
      metadata: {
        saas_subscription: "1",
        organization_id: organizationId,
      },
    },
    // Don't allow promotion codes here unless you want to; uncomment to enable.
    // allow_promotion_codes: true,
  });

  await logAudit({
    organizationId,
    action: "create",
    entityType: "subscription",
    entityLabel: "Started SaaS checkout",
    after: { checkout_session_id: session.id },
  });

  return { checkoutUrl: session.url };
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
