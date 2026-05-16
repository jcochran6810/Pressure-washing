// One-time login link to the connected account's Stripe Express dashboard.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSessionAndOrg } from "@/lib/org";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const stripe = getStripe();
  const { organization } = await getSessionAndOrg();
  const accountId = organization?.stripe_connect_account_id as string | null;

  if (!stripe || !accountId) {
    return NextResponse.redirect(new URL("/settings", request.url));
  }

  try {
    const link = await stripe.accounts.createLoginLink(accountId);
    return NextResponse.redirect(link.url);
  } catch (err: any) {
    return NextResponse.redirect(new URL(`/settings?stripe_connect_error=${encodeURIComponent(err.message)}`, request.url));
  }
}
