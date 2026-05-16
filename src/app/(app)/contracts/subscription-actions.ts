"use server";

import { getSessionAndOrg } from "@/lib/org";
import { getStripe } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// Convert a contract into a Stripe subscription so the customer gets charged
// automatically every cadence. Requires:
//  - org has stripe_connect_account_id (Connect active)
//  - customer has email
//  - default_amount > 0 (we use that as the subscription amount per period)
//
// Cadence_months is mapped to Stripe interval/interval_count.

export async function createContractSubscription(contractId: string) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured. Set STRIPE_SECRET_KEY in .env.local.");
  const acct = organization?.stripe_connect_account_id as string | null;
  if (!acct || organization?.stripe_connect_status !== "active") {
    throw new Error("Stripe Connect is not active for this organization. Connect it in Settings first.");
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("*, customers(*)")
    .eq("id", contractId)
    .eq("organization_id", organizationId)
    .single();
  if (!contract) throw new Error("Contract not found");
  if ((contract as any).stripe_subscription_id) throw new Error("Subscription already exists for this contract");

  const cust: any = (contract as any).customers;
  if (!cust?.email) throw new Error("Customer must have an email address to bill via Stripe.");
  const amount = Number((contract as any).default_amount ?? 0);
  if (amount <= 0) throw new Error("Set a default amount on the contract before creating a subscription.");

  const currency = (organization?.currency || "USD").toLowerCase();
  const months = Math.max(1, Number((contract as any).cadence_months || 1));

  // Map cadence_months → Stripe interval
  let interval: "month" | "year";
  let interval_count: number;
  if (months >= 12 && months % 12 === 0) {
    interval = "year";
    interval_count = months / 12;
  } else {
    interval = "month";
    interval_count = months;
  }

  // Stripe limits: month interval_count must be 1-12. If we somehow exceed that, fall back to a yearly chunk.
  if (interval === "month" && interval_count > 12) {
    interval = "year";
    interval_count = Math.max(1, Math.round(interval_count / 12));
  }

  // Create or look up the Stripe customer (on the connected account)
  let stripeCustomerId = cust.stripe_customer_id as string | null;
  if (!stripeCustomerId) {
    const created = await stripe.customers.create(
      {
        email: cust.email,
        name: cust.company_name || `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim() || undefined,
        phone: cust.phone || cust.mobile_phone || undefined,
        metadata: { customer_id: cust.id, organization_id: organizationId },
      },
      { stripeAccount: acct },
    );
    stripeCustomerId = created.id;
    await supabase.from("customers").update({ stripe_customer_id: stripeCustomerId }).eq("id", cust.id);
  }

  // Create the product + recurring price on the connected account
  const product = await stripe.products.create(
    { name: (contract as any).name },
    { stripeAccount: acct },
  );
  const price = await stripe.prices.create(
    {
      product: product.id,
      currency,
      unit_amount: Math.round(amount * 100),
      recurring: { interval, interval_count },
    },
    { stripeAccount: acct },
  );

  // Use Stripe Checkout to collect a payment method + start the subscription
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${appUrl}/contracts/${contractId}?subscription=ok`,
      cancel_url: `${appUrl}/contracts/${contractId}?subscription=cancelled`,
      metadata: { contract_id: contractId, organization_id: organizationId },
    },
    { stripeAccount: acct },
  );

  await supabase.from("contracts").update({
    stripe_customer_id: stripeCustomerId,
  }).eq("id", contractId);

  await logAudit({
    organizationId,
    action: "send",
    entityType: "contract",
    entityId: contractId,
    entityLabel: (contract as any).name,
    after: { stripe_checkout_url: session.url },
  });

  revalidatePath(`/contracts/${contractId}`);
  // Server actions can't redirect to absolute URLs — return the URL and let the
  // detail page render it as a "Pay & subscribe" button.
  return { checkoutUrl: session.url };
}

export async function cancelContractSubscription(contractId: string) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured.");
  const acct = organization?.stripe_connect_account_id as string | null;

  const { data: contract } = await supabase
    .from("contracts")
    .select("stripe_subscription_id, name")
    .eq("id", contractId)
    .eq("organization_id", organizationId)
    .single();
  const subId = (contract as any)?.stripe_subscription_id as string | null;
  if (!subId) throw new Error("No active subscription on this contract.");

  await stripe.subscriptions.cancel(subId, acct ? { stripeAccount: acct } : undefined);
  await supabase.from("contracts").update({ stripe_subscription_id: null }).eq("id", contractId);

  await logAudit({
    organizationId,
    action: "void",
    entityType: "contract",
    entityId: contractId,
    entityLabel: (contract as any)?.name ?? null,
  });

  revalidatePath(`/contracts/${contractId}`);
}
