// Stripe webhook. Handles BOTH platform-level events (legacy) and Connect
// events from connected accounts. For Connect events Stripe sets event.account
// to the acct_... id; we look up which org owns it and route the payment.
//
// Configure ONE endpoint in Stripe Developers → Webhooks, listening to
// checkout.session.completed and (optionally) account.updated, with
// "Listen to events on Connected accounts" enabled. The same signing secret
// validates both event shapes.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import type Stripe from "stripe";

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
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ error: `bad signature: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (!session.amount_total) return NextResponse.json({ received: true });
    const supabase = adminClient();

    // Resolve which org this event belongs to:
    //   1. Connect event → event.account is the acct_..., look up by stripe_account_id
    //   2. Legacy platform event → metadata.organization_id (single-tenant fallback)
    let organization_id: string | null = (session.metadata?.organization_id as string) || null;
    if (event.account) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .eq("stripe_account_id", event.account)
        .maybeSingle();
      if (org) organization_id = org.id;
    }

    const invoice_id = session.metadata?.invoice_id as string | undefined;
    if (!organization_id || !invoice_id) {
      // Nothing we can pin this payment to — ack so Stripe doesn't retry forever.
      return NextResponse.json({ received: true, note: "no org/invoice mapping" });
    }

    const amount = session.amount_total / 100;
    const { data: inv } = await supabase
      .from("invoices")
      .select("customer_id, total, amount_paid")
      .eq("id", invoice_id)
      .eq("organization_id", organization_id)
      .single();
    if (!inv) return NextResponse.json({ received: true, note: "invoice not found" });

    await supabase.from("payments").insert({
      organization_id,
      invoice_id,
      customer_id: inv.customer_id,
      amount,
      payment_method: "stripe",
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
    });
    const new_paid = Number(inv.amount_paid ?? 0) + amount;
    const balance = Math.max(0, Number(inv.total ?? 0) - new_paid);
    const status = balance === 0 ? "paid" : "partial";
    await supabase
      .from("invoices")
      .update({
        amount_paid: new_paid,
        balance_due: balance,
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", invoice_id);
  } else if (event.type === "account.application.deauthorized") {
    // Stripe fires this when a connected account is disconnected from outside
    // our app (e.g. from their Stripe dashboard). Clear our local state.
    if (event.account) {
      const supabase = adminClient();
      await supabase
        .from("organizations")
        .update({
          stripe_account_id: null,
          stripe_connect_status: null,
          stripe_connect_email: null,
          stripe_connect_country: null,
          stripe_connect_connected_at: null,
        } as any)
        .eq("stripe_account_id", event.account);
    }
  }

  return NextResponse.json({ received: true });
}
