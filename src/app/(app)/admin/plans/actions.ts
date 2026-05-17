"use server";

import { requirePlatformAdmin } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import { priceChangeEmail } from "@/lib/lifecycle-emails";
import { revalidatePath } from "next/cache";

function parseFeatures(raw: string): string[] {
  return raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

export async function upsertPlan(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const id = String(formData.get("id") || "") || null;
  const payload = {
    slug: String(formData.get("slug") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim() || null,
    monthly_amount: Number(formData.get("monthly_amount") || 0),
    annual_amount: Number(formData.get("annual_amount") || 0) || null,
    stripe_price_id_monthly: String(formData.get("stripe_price_id_monthly") || "").trim() || null,
    stripe_price_id_annual: String(formData.get("stripe_price_id_annual") || "").trim() || null,
    features: parseFeatures(String(formData.get("features") || "")),
    is_featured: formData.get("is_featured") === "on",
    is_active: formData.get("is_active") === "on",
    sort_order: Number(formData.get("sort_order") || 0),
    updated_at: new Date().toISOString(),
  };
  if (id) {
    await supabase.from("subscription_plans").update(payload).eq("id", id);
  } else {
    await supabase.from("subscription_plans").insert(payload as any);
  }
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
}

export async function deletePlan(id: string) {
  const { supabase } = await requirePlatformAdmin();
  await supabase.from("subscription_plans").delete().eq("id", id);
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
}

// Email every paying customer on this plan about a price change.
// Per ToS: give at least 30 days' notice. We don't enforce that here —
// the admin chose the effective date and the form defaults to +30 days.
export async function broadcastPriceChange(planId: string, formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const oldAmount = Number(formData.get("old_amount") || 0);
  const newAmount = Number(formData.get("new_amount") || 0);
  const effectiveDate = String(formData.get("effective_date") || "");
  const customMessage = String(formData.get("custom_message") || "").trim() || undefined;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Find all active orgs on this plan
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("slug, name")
    .eq("id", planId)
    .single();
  if (!plan) throw new Error("Plan not found");

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, email")
    .eq("subscription_plan", plan.slug)
    .in("subscription_status", ["active", "past_due", "trialing"]);

  let sent = 0;
  let skipped = 0;
  for (const org of orgs ?? []) {
    if (!org.email) { skipped++; continue; }
    const tpl = priceChangeEmail({
      orgName: org.name,
      appUrl,
      oldAmount: `$${oldAmount.toFixed(2)}`,
      newAmount: `$${newAmount.toFixed(2)}`,
      effectiveDate: new Date(effectiveDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      customMessage,
    });
    await sendEmail({ to: org.email, subject: tpl.subject, html: tpl.html });
    // Also write an in-app notification
    await supabase.from("notifications").insert({
      organization_id: org.id,
      kind: "system",
      title: `Price update — effective ${effectiveDate}`,
      body: `Monthly subscription is changing from $${oldAmount.toFixed(2)} to $${newAmount.toFixed(2)}.`,
      url: "/billing",
    });
    sent++;
  }

  console.log(`broadcastPriceChange: sent ${sent}, skipped ${skipped}`);
  revalidatePath("/admin/plans");
}
