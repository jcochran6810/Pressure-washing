import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import { emailPaymentFailed, emailSubscriptionRestored } from "@/lib/billing";
import type Stripe from "stripe";

export const runtime = "nodejs";

// SaaS subscription event handler (platform-level events, not Connect)
async function handlePlatformEvent(event: Stripe.Event, supabase: any) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.saas_subscription !== "1") return;
    const orgId = session.metadata?.organization_id;
    if (!orgId || !session.subscription) return;
    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    await supabase.from("organizations").update({
      subscription_status: "active",
      subscription_stripe_id: subId,
      past_due_since: null,
      past_due_notified_at: null,
    }).eq("id", orgId);
    await supabase.from("notifications").insert({
      organization_id: orgId,
      kind: "system",
      title: "Subscription active",
      body: "Thanks for subscribing — full access is unlocked.",
      url: "/billing",
    });
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const orgId = sub.metadata?.organization_id;
    if (!orgId) return;
    const status = mapStripeSubStatus(sub.status);
    const update: any = {
      subscription_status: status,
      subscription_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    };
    if (status === "active") {
      update.past_due_since = null;
      update.past_due_notified_at = null;
    }
    await supabase.from("organizations").update(update).eq("id", orgId);

    // If we just transitioned from past_due → active, notify the owner.
    if (status === "active") {
      const { data: org } = await supabase
        .from("organizations")
        .select("name, email, past_due_since")
        .eq("id", orgId)
        .single();
      if (org?.email && org?.past_due_since) {
        await emailSubscriptionRestored({
          to: org.email,
          orgName: org.name,
          appUrl,
        });
      }
    }
  }

  if (event.type === "invoice.payment_failed") {
    const inv = event.data.object as Stripe.Invoice;
    const subId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
    if (!subId) return;
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, email, past_due_notified_at")
      .eq("subscription_stripe_id", subId)
      .maybeSingle();
    if (!org) return;

    await supabase.from("organizations").update({
      subscription_status: "past_due",
      past_due_since: new Date().toISOString(),
    }).eq("id", org.id);

    await supabase.from("notifications").insert({
      organization_id: org.id,
      kind: "system",
      title: "Payment failed",
      body: "Your subscription card declined. Update payment method to restore access.",
      url: "/billing",
    });

    // Send the email once per past-due cycle (Stripe retries 4 times in 21 days;
    // we don't want to email on every retry).
    const lastNotified = org.past_due_notified_at ? new Date(org.past_due_notified_at) : null;
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (org.email && (!lastNotified || lastNotified < dayAgo)) {
      const amount = inv.amount_due ? `$${(inv.amount_due / 100).toFixed(2)}` : null;
      await emailPaymentFailed({
        to: org.email,
        orgName: org.name,
        amount,
        appUrl,
      });
      await supabase.from("organizations").update({
        past_due_notified_at: new Date().toISOString(),
      }).eq("id", org.id);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const orgId = sub.metadata?.organization_id;
    if (!orgId) return;
    await supabase.from("organizations").update({
      subscription_status: "cancelled",
      subscription_stripe_id: null,
    }).eq("id", orgId);
    await supabase.from("notifications").insert({
      organization_id: orgId,
      kind: "system",
      title: "Subscription cancelled",
      body: "Your records remain accessible. Resubscribe any time in /billing.",
      url: "/billing",
    });
  }
}

function mapStripeSubStatus(stripeStatus: Stripe.Subscription.Status): "active" | "past_due" | "cancelled" | "trialing" {
  switch (stripeStatus) {
    case "active":
    case "incomplete":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    default:
      return "active";
  }
}

function adminClient() {
  // Webhook context has no user session — use the service-role key so RLS
  // doesn't block writes. Metadata on the Stripe session is validated below.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
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

  const supabase = adminClient();

  // ============================================================
  // PLATFORM EVENTS — SaaS subscriptions (we charge our customers)
  // event.account is NOT set for platform events.
  // event.account IS set for connected-account events (their customers).
  // ============================================================
  if (!event.account) {
    await handlePlatformEvent(event, supabase);
  }

  // ============================================================
  // CONNECTED ACCOUNT EVENTS — businesses charging their own customers
  // ============================================================
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoice_id = session.metadata?.invoice_id;
    const organization_id = session.metadata?.organization_id;
    const contract_id = session.metadata?.contract_id;
    const saas_subscription = session.metadata?.saas_subscription;

    // SaaS subscription checkout was completed — already handled above.
    if (saas_subscription === "1") return NextResponse.json({ received: true });

    // Subscription started for a contract
    if (contract_id && organization_id && session.mode === "subscription" && session.subscription) {
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      await supabase.from("contracts").update({
        stripe_subscription_id: subId,
      }).eq("id", contract_id).eq("organization_id", organization_id);
      await supabase.from("notifications").insert({
        organization_id,
        kind: "system",
        title: "Subscription started",
        body: `Customer signed up for the recurring billing on a contract`,
        entity_type: "contract",
        entity_id: contract_id,
        url: `/contracts/${contract_id}`,
      });
    }

    // One-off payment link for an invoice
    if (invoice_id && organization_id && session.amount_total) {
      const amount = session.amount_total / 100;
      const { data: inv } = await supabase
        .from("invoices")
        .select("customer_id, total, amount_paid, invoice_number")
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
        await supabase.from("notifications").insert({
          organization_id,
          kind: "payment_received",
          title: `Stripe payment received`,
          body: `${inv.invoice_number} — $${amount.toFixed(2)}`,
          entity_type: "invoice",
          entity_id: invoice_id,
          url: `/invoices/${invoice_id}`,
        });
      }
    }
  }

  // Recurring subscription invoice paid — record on contract's customer
  if (event.type === "invoice.paid") {
    const stripeInv = event.data.object as Stripe.Invoice;
    const subId = typeof stripeInv.subscription === "string" ? stripeInv.subscription : stripeInv.subscription?.id;
    if (subId) {
      const { data: contract } = await supabase
        .from("contracts")
        .select("id, organization_id, customer_id, name")
        .eq("stripe_subscription_id", subId)
        .maybeSingle();
      if (contract) {
        const amount = (stripeInv.amount_paid ?? 0) / 100;
        await supabase.from("payments").insert({
          organization_id: contract.organization_id,
          customer_id: contract.customer_id,
          amount,
          payment_method: "stripe",
          stripe_payment_intent_id: typeof stripeInv.payment_intent === "string" ? stripeInv.payment_intent : null,
          notes: `Subscription payment — ${contract.name}`,
        });
        await supabase.from("notifications").insert({
          organization_id: contract.organization_id,
          kind: "payment_received",
          title: "Subscription charge succeeded",
          body: `${contract.name} — $${amount.toFixed(2)}`,
          entity_type: "contract",
          entity_id: contract.id,
          url: `/contracts/${contract.id}`,
        });
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    await supabase.from("contracts").update({ stripe_subscription_id: null })
      .eq("stripe_subscription_id", sub.id);
  }

  // Stripe Connect account updated — sync our organization status
  if (event.type === "account.updated") {
    const acct = event.data.object as Stripe.Account;
    const status = acct.charges_enabled && acct.payouts_enabled ? "active" : acct.details_submitted ? "pending" : "onboarding";
    await supabase.from("organizations").update({
      stripe_connect_status: status,
      stripe_connect_connected_at: status === "active" ? new Date().toISOString() : null,
    }).eq("stripe_connect_account_id", acct.id);
  }

  return NextResponse.json({ received: true });
}
