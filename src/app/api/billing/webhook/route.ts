// Stripe webhook for subscription lifecycle. Wires:
//   checkout.session.completed       → set tier, store subscription_id, status, trial_ends_at
//   customer.subscription.updated    → update tier/status + trial_ends_at (e.g. past_due, trialing)
//   customer.subscription.deleted    → drop tier back to basic, clear sub_id
//
// Configure the endpoint in Stripe (Developers → Webhooks) and put the signing
// secret in STRIPE_BILLING_WEBHOOK_SECRET. Distinct from the existing payment
// webhook so the same project can serve both.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getStripe } from "@/lib/stripe";
import { TIERS, type Tier } from "@/lib/billing";

export const runtime = "nodejs";

function adminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "missing signature/secret" }, { status: 400 });

  const raw = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e: any) {
    return NextResponse.json({ error: `signature: ${e.message}` }, { status: 400 });
  }

  const supabase = adminClient();

  async function applySubUpdate(
    orgId: string,
    tier: Tier,
    status: string | null,
    subId: string | null,
    trialEnd: number | null,
  ) {
    if (!(tier in TIERS)) tier = "basic";
    const patch: Record<string, unknown> = {
      subscription_tier: tier,
      subscription_status: status,
      stripe_subscription_id: subId,
      updated_at: new Date().toISOString(),
    };
    if (trialEnd) patch.trial_ends_at = new Date(trialEnd * 1000).toISOString();
    await (supabase as any).from("organizations").update(patch).eq("id", orgId);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const orgId = session.metadata?.organization_id;
      const tier = (session.metadata?.tier as Tier) || "basic";
      const subId = (session.subscription as string) || null;
      const customerId = (session.customer as string) || null;
      if (orgId) {
        // The session itself doesn't carry trial_end — that comes through on
        // the customer.subscription.updated event Stripe fires right after.
        await applySubUpdate(orgId, tier, "active", subId, null);
        if (customerId) {
          await (supabase as any)
            .from("organizations")
            .update({ stripe_customer_id: customerId })
            .eq("id", orgId);
        }
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
      const sub = event.data.object as any;
      const orgId = sub.metadata?.organization_id;
      const tier = (sub.metadata?.tier as Tier) || "basic";
      if (orgId) {
        await applySubUpdate(orgId, tier, sub.status ?? "unknown", sub.id, sub.trial_end ?? null);
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as any;
      const orgId = sub.metadata?.organization_id;
      if (orgId) {
        await applySubUpdate(orgId, "basic", "canceled", null, null);
      }
    }
  } catch (e) {
    console.error("billing webhook handler failed", e);
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
