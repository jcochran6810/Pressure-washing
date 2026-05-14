"use server";

import { getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { getDefaultsForTrade } from "@/lib/trade-defaults";

export async function createService(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const materialMods: Record<string, number> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("material_mod_")) {
      const mat = k.replace("material_mod_", "");
      const val = Number(v);
      if (mat && !isNaN(val)) materialMods[mat] = val;
    }
  }

  await supabase.from("services").insert({
    organization_id: organizationId,
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim() || null,
    category: String(formData.get("category") || "").trim() || null,
    pricing_unit: String(formData.get("pricing_unit") || "flat"),
    default_price: Number(formData.get("default_price") || 0) || null,
    min_price: Number(formData.get("min_price") || 0) || null,
    price_per_sqft: Number(formData.get("price_per_sqft") || 0) || null,
    price_per_linear_ft: Number(formData.get("price_per_linear_ft") || 0) || null,
    default_duration_minutes: Number(formData.get("default_duration_minutes") || 60),
    height_modifier_per_story: Number(formData.get("height_modifier_per_story") || 0.15),
    material_modifiers: materialMods,
    is_addon: formData.get("is_addon") === "on",
    active: true,
  });
  revalidatePath("/services");
}

export async function updateService(id: string, formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const materialMods: Record<string, number> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("material_mod_")) {
      const mat = k.replace("material_mod_", "");
      const val = Number(v);
      if (mat && !isNaN(val)) materialMods[mat] = val;
    }
  }
  await supabase.from("services").update({
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim() || null,
    category: String(formData.get("category") || "").trim() || null,
    pricing_unit: String(formData.get("pricing_unit") || "flat"),
    default_price: Number(formData.get("default_price") || 0) || null,
    min_price: Number(formData.get("min_price") || 0) || null,
    price_per_sqft: Number(formData.get("price_per_sqft") || 0) || null,
    price_per_linear_ft: Number(formData.get("price_per_linear_ft") || 0) || null,
    default_duration_minutes: Number(formData.get("default_duration_minutes") || 60),
    height_modifier_per_story: Number(formData.get("height_modifier_per_story") || 0.15),
    material_modifiers: materialMods,
    is_addon: formData.get("is_addon") === "on",
    active: formData.get("active") === "on",
  }).eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/services");
}

export async function deleteService(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("services").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/services");
}

// Insert the trade default services for the org's current business type. Skips
// names that already exist so re-running won't create duplicates.
// Accepts (and ignores) FormData so the function can be wired to a `<form action>`.
export async function loadTradeDefaults(_formData?: FormData): Promise<void> {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const businessTypeId = (organization as any)?.business_type_id ?? "pressure_washing";
  const defaults = getDefaultsForTrade(businessTypeId);

  const { data: existing } = await supabase
    .from("services")
    .select("name")
    .eq("organization_id", organizationId);
  const existingNames = new Set((existing ?? []).map((s) => (s.name ?? "").toLowerCase()));

  const toInsert = defaults
    .filter((d) => !existingNames.has(d.name.toLowerCase()))
    .map((d) => ({
      organization_id: organizationId,
      name: d.name,
      description: d.description ?? null,
      category: d.category,
      pricing_unit: d.pricing_unit,
      default_price: d.default_price,
      active: true,
    } as any));

  if (toInsert.length) {
    await supabase.from("services").insert(toInsert);
  }
  revalidatePath("/services");
}

export async function updateGlobalPricingSettings(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("organizations").update({
    global_min_job_price: Number(formData.get("global_min_job_price") || 0),
    deposit_threshold: Number(formData.get("deposit_threshold") || 0) || null,
    deposit_percentage: Number(formData.get("deposit_percentage") || 0.25),
  }).eq("id", organizationId);
  revalidatePath("/services");
}
