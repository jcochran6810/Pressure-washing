// Creates a Stripe Checkout session to collect the deposit on an approved
// estimate. Routed through the org's Stripe Connect account so the funds
// land in their bank. Webhook (api/stripe/webhook) later marks deposit_paid
// when the checkout.session.completed event fires with metadata.kind = 'estimate_deposit'.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getStripe } from "@/lib/stripe";
import { platformFeeAmount } from "@/lib/stripe-connect";

export const runtime = "nodejs";

function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const stripe = getStripe();
  if (!stripe) return NextResponse.redirect(new URL(`/quote/${token}?deposit=unconfigured`, request.url));

  const supabase = publicClient();
  const { data: est } = await supabase
    .from("estimates")
    .select("id, total, deposit_amount, deposit_paid, customers(email, first_name, last_name), organizations(name, stripe_account_id, currency)")
    .eq("approval_token", token)
    .maybeSingle();
  if (!est) return NextResponse.redirect(new URL(`/quote/${token}?deposit=notfound`, request.url));
  if (est.deposit_paid) return NextResponse.redirect(new URL(`/quote/${token}?deposit=already`, request.url));
  if (!est.deposit_amount || Number(est.deposit_amount) <= 0) {
    return NextResponse.redirect(new URL(`/quote/${token}?deposit=zero`, request.url));
  }

  const org = est.organizations as any;
  if (!org?.stripe_account_id) {
    return NextResponse.redirect(new URL(`/quote/${token}?deposit=no_connect`, request.url));
  }

  const customer = est.customers as any;
  const cents = Math.round(Number(est.deposit_amount) * 100);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const currency = (org.currency || "USD").toLowerCase();
  const feeCents = platformFeeAmount(cents);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: customer?.email ?? undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount: cents,
          product_data: {
            name: `Deposit — ${org.name}`,
            description: `Deposit on approved estimate`,
          },
        },
      }],
      payment_intent_data: {
        application_fee_amount: feeCents > 0 ? feeCents : undefined,
        metadata: {
          kind: "estimate_deposit",
          estimate_id: est.id,
          token,
        },
      },
      success_url: `${appUrl}/quote/${token}?deposit=paid`,
      cancel_url: `${appUrl}/quote/${token}?deposit=canceled`,
      metadata: {
        kind: "estimate_deposit",
        estimate_id: est.id,
        token,
      },
    }, { stripeAccount: org.stripe_account_id });

    return NextResponse.redirect(session.url ?? `${appUrl}/quote/${token}`);
  } catch (err: any) {
    return NextResponse.redirect(new URL(`/quote/${token}?deposit=error&msg=${encodeURIComponent(err.message)}`, request.url));
  }
}
