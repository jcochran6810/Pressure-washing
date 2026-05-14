// Create a Stripe Checkout session for the chosen tier and redirect to it.
// On success the customer comes back to /settings?billing=updated and the
// webhook flips the org's subscription_tier when checkout.session.completed
// arrives.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { stripePriceIdFor, TIERS, type Tier } from "@/lib/billing";
import { getSessionAndOrg } from "@/lib/org";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tierParam = url.searchParams.get("tier") as Tier | null;
  if (!tierParam || !(tierParam in TIERS)) {
    return NextResponse.json({ error: "tier query param required (solo|pro)" }, { status: 400 });
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

  // Reuse the existing Stripe customer if we've created one before.
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/settings?billing=updated`,
    cancel_url: `${appUrl}/settings?billing=canceled`,
    subscription_data: { metadata: { organization_id: organizationId, tier: tierParam } },
    metadata: { organization_id: organizationId, tier: tierParam },
  });

  return NextResponse.redirect(session.url ?? `${appUrl}/settings`);
}
