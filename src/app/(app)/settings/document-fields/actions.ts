"use server";

import { getSessionAndOrgForMutation as getSessionAndOrg } from "@/lib/org";
import { getStripe } from "@/lib/stripe";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function togglePremiumTemplates(formData: FormData) {
  const enable = formData.get("enable") === "1";
  const { supabase, organizationId, organization } = await getSessionAndOrg();

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("slug, premium_templates_allowed, addon_premium_templates_stripe_price_id")
    .eq("slug", (organization as any)?.subscription_plan ?? "starter")
    .maybeSingle();
  if (!plan?.premium_templates_allowed) {
    throw new Error("Your current plan doesn't support Premium Templates. Upgrade to Plus or Pro.");
  }

  const stripe = getStripe();
  const subId = (organization as any)?.subscription_stripe_id;
  if (stripe && subId && plan.addon_premium_templates_stripe_price_id) {
    const sub = await stripe.subscriptions.retrieve(subId);
    const existing = sub.items.data.find((i: any) => i.price?.id === plan.addon_premium_templates_stripe_price_id);
    if (enable && !existing) {
      const created = await stripe.subscriptionItems.create({
        subscription: subId,
        price: plan.addon_premium_templates_stripe_price_id,
        quantity: 1,
        proration_behavior: "create_prorations",
      });
      await supabase.from("organizations").update({
        premium_templates_enabled: true,
        premium_templates_stripe_item_id: created.id,
      }).eq("id", organizationId);
    } else if (!enable && existing) {
      await stripe.subscriptionItems.del(existing.id, { proration_behavior: "create_prorations" });
      await supabase.from("organizations").update({
        premium_templates_enabled: false,
        premium_templates_stripe_item_id: null,
      }).eq("id", organizationId);
    } else {
      await supabase.from("organizations").update({ premium_templates_enabled: enable }).eq("id", organizationId);
    }
  } else {
    // Stripe not configured / no subscription — toggle locally only (dev mode).
    await supabase.from("organizations").update({ premium_templates_enabled: enable }).eq("id", organizationId);
  }

  await logAudit({
    organizationId,
    action: enable ? "create" : "delete",
    entityType: "addon",
    entityLabel: "premium_templates",
  });
  revalidatePath("/settings/document-fields");
}

export async function updateDocumentFields(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();

  // Parse keys of the form `estimate__notes`, `invoice__tax`, `receipt__payment_method`
  const config: Record<string, Record<string, boolean>> = { estimate: {}, invoice: {}, receipt: {} };
  // First, collect every possible key from the form
  const keys = new Set<string>();
  for (const [k] of formData.entries()) keys.add(k);
  // For each scope, find all keys that look like `<scope>__<field>` AND check what was submitted.
  // Unchecked boxes don't appear in formData, so we need to know all possible fields.
  // We'll set submitted ones to true and let the resolver fall back for missing ones.
  // To get correct false-state on unchecked boxes we explicitly send all known fields.
  // Easier: any key starting with scope__ becomes true, the absence means false.
  for (const k of keys) {
    const [scope, ...rest] = k.split("__");
    if (!rest.length || !["estimate", "invoice", "receipt"].includes(scope)) continue;
    const field = rest.join("__");
    config[scope][field] = formData.get(k) === "on";
  }

  // To turn missing fields into false, also serialize false for every known field that
  // wasn't present. Simpler: store only the overrides as-is. We'll re-resolve missing
  // fields to default-true. But user expected unchecked = false.
  // Solution: walk the resolved defaults and store explicit false for missing keys.
  const { resolveEstimateFields, resolveInvoiceFields, resolveReceiptFields } = await import("@/lib/document-fields");
  const allEstimate = resolveEstimateFields({});
  const allInvoice = resolveInvoiceFields({});
  const allReceipt = resolveReceiptFields({});
  for (const k of Object.keys(allEstimate)) {
    config.estimate[k] = formData.get(`estimate__${k}`) === "on";
  }
  for (const k of Object.keys(allInvoice)) {
    config.invoice[k] = formData.get(`invoice__${k}`) === "on";
  }
  for (const k of Object.keys(allReceipt)) {
    config.receipt[k] = formData.get(`receipt__${k}`) === "on";
  }

  await supabase
    .from("organizations")
    .update({ document_field_visibility: config })
    .eq("id", organizationId);

  await logAudit({
    organizationId,
    action: "update",
    entityType: "document_fields",
    after: config,
  });
  revalidatePath("/settings/document-fields");
  revalidatePath("/estimates");
  revalidatePath("/invoices");
}
