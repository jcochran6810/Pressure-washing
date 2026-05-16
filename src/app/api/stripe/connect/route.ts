// Start a Stripe Connect onboarding flow for the current org.
// We create an Express account (Stripe-hosted onboarding) and return an account link.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSessionAndOrg } from "@/lib/org";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.redirect(new URL("/settings?stripe=not_configured", request.url));
  }

  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  let accountId = organization?.stripe_connect_account_id as string | null;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "US",
      email: organization?.email || undefined,
      business_type: "individual",
      metadata: { organization_id: organizationId },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    accountId = account.id;
    await supabase.from("organizations").update({
      stripe_connect_account_id: accountId,
      stripe_connect_status: "onboarding",
    }).eq("id", organizationId);
    await logAudit({
      organizationId,
      action: "connect",
      entityType: "integration",
      entityLabel: "Stripe Connect (started)",
      after: { stripe_connect_account_id: accountId },
    });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/api/stripe/connect`,
    return_url: `${appUrl}/api/stripe/connect/return`,
    type: "account_onboarding",
  });

  return NextResponse.redirect(link.url);
}
