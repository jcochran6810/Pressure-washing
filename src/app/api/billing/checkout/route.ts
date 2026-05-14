// Create a Stripe Checkout session for the chosen tier and redirect to it.
// On success the customer comes back to /settings?billing=updated and the
// webhook flips the org's subscription_tier when checkout.session.completed
// arrives.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { stripePriceIdFor, TIERS, TRIAL_DAYS, trialStateFor, type Tier } from "@/lib/billing";
import { getSessionAndOrg } from "@/lib/org";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tierParam = url.searchParams.get("tier") as Tier | null;
  if (!tierParam || !(tierParam in TIERS)) {
    return NextResponse.json({ error: "tier query param required (basic|plus|pro)" }, { status: 400 });
  }
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  const priceId = stripePriceIdFor(tierParam);
  if (!priceId) {
    return NextResponse.json(
      { error: `${TIERS[tierParam].stripePriceEnvVar} not set on this deployment` },
      { status: 503 },
    );
  }

  const { supabase, organizationId, organization, user } = await getSessionAndOrg();

  let customerId = (organization as any)?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: organization?.name ?? undefined,
      metadata: { organization_id: organizationId },
    });
    customerId = customer.id;
    await supabase
      .from("organizations")
      .update({ stripe_customer_id: customerId } as any)
      .eq("id", organizationId);
  }

  // Honor the org's remaining in-app trial: if they still have free days left
  // give Stripe the matching trial_period_days so they aren't double-billed.
  // Otherwise fall back to the standard 10-day trial for first-time upgraders.
  const trial = trialStateFor((organization as any)?.trial_ends_at);
  const trialPeriodDays = trial.active ? trial.daysRemaining : TRIAL_DAYS;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings?billing=updated`,
    cancel_url: `${appUrl}/settings?billing=canceled`,
    subscription_data: {
      trial_period_days: trialPeriodDays,
      metadata: { organization_id: organizationId, tier: tierParam },
    },
    metadata: { organization_id: organizationId, tier: tierParam },
  });

  return NextResponse.redirect(session.url ?? `${appUrl}/settings`);
}
