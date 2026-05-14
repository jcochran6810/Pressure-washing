// Open the Stripe Customer Portal so the org can update payment method,
// cancel, change plan, etc. Requires a stripe_customer_id on the org.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSessionAndOrg } from "@/lib/org";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  const { organization } = await getSessionAndOrg();
  const customerId = (organization as any)?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "Subscribe first to manage billing." }, { status: 400 });
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/settings`,
  });
  return NextResponse.redirect(session.url);
}
