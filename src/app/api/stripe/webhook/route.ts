import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import type Stripe from "stripe";

export const runtime = "nodejs";

function adminClient() {
  // Webhook context — no user. We use anon key + service role bypass via metadata-validated writes.
  // For production, swap to SUPABASE_SERVICE_ROLE_KEY.
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
    const invoice_id = session.metadata?.invoice_id;
    const organization_id = session.metadata?.organization_id;
    if (invoice_id && organization_id && session.amount_total) {
      const supabase = adminClient();
      const amount = session.amount_total / 100;
      const { data: inv } = await supabase
        .from("invoices")
        .select("customer_id, total, amount_paid")
        .eq("id", invoice_id)
        .single();
      if (inv) {
        await supabase.from("payments").insert({
          organization_id,
          invoice_id,
          customer_id: inv.customer_id,
          amount,
          payment_method: "stripe",
          stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
        });
        const new_paid = Number(inv.amount_paid ?? 0) + amount;
        const balance = Math.max(0, Number(inv.total ?? 0) - new_paid);
        const status = balance === 0 ? "paid" : "partial";
        await supabase.from("invoices").update({
          amount_paid: new_paid,
          balance_due: balance,
          status,
          paid_at: status === "paid" ? new Date().toISOString() : null,
        }).eq("id", invoice_id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
