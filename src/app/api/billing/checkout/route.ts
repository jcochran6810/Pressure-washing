// Create a Stripe Checkout session for the chosen tier and redirect to it.
// On success the customer comes back to /settings?billing=updated and the
// webhook flips the org's subscription_tier when checkout.session.completed
// arrives.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { stripePriceIdFor, TIERS, TRIAL_DAYS, trialStateFor, type Tier } from "@/lib/billing";
import { createWizardCheckoutSession } from "@/lib/billing-checkout";
import { getSessionAndOrg } from "@/lib/org";

export const runtime = "nodejs";

// JSON variant used by the setup wizard. Builds the line items from the
// org's current tier + add-on selections (trade overage, pro packs) and
// returns the Checkout URL so the wizard's server action can redirect.
// The GET handler below still serves the existing settings-page flow.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const organizationId = String(body?.organizationId ?? "");
  if (!organizationId) return NextResponse.json({ error: "missing_org" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || !["owner", "admin"].includes((member as any).role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await createWizardCheckoutSession({
    organizationId,
    userId: user.id,
    origin: new URL(request.url).origin,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, message: result.message },
      { status: result.reason === "stripe_not_configured" ? 400 : 500 },
    );
  }
  return NextResponse.json({ url: result.url });
}

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
