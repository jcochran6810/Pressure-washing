"use server";

import { getSessionAndOrgForMutation as getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createChemical(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { error } = await supabase.from("chemicals").insert({
    organization_id: organizationId,
    name: String(formData.get("name") || "").trim(),
    brand: String(formData.get("brand") || "").trim() || null,
    sku: String(formData.get("sku") || "").trim() || null,
    category: String(formData.get("category") || "").trim() || null,
    unit: String(formData.get("unit") || "gallon").trim() || "gallon",
    current_stock: Number(formData.get("current_stock") || 0),
    reorder_level: Number(formData.get("reorder_level") || 0),
    cost_per_unit: Number(formData.get("cost_per_unit") || 0) || null,
    supplier: String(formData.get("supplier") || "").trim() || null,
    hazard_class: String(formData.get("hazard_class") || "").trim() || null,
    sds_url: String(formData.get("sds_url") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/chemicals");
  redirect("/chemicals");
}

export async function recordChemicalTransaction(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const chemical_id = String(formData.get("chemical_id") || "");
  const transaction_type = String(formData.get("transaction_type") || "purchase") as any;
  const quantity = Number(formData.get("quantity") || 0);
  const cost = Number(formData.get("cost") || 0) || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  if (!chemical_id || !quantity) throw new Error("Chemical and quantity required");

  const { data: chem } = await supabase.from("chemicals").select("current_stock").eq("id", chemical_id).single();
  const stockDelta = transaction_type === "purchase" || transaction_type === "adjustment" ? quantity : -quantity;
  const newStock = Math.max(0, Number(chem?.current_stock ?? 0) + (transaction_type === "adjustment" ? (quantity - Number(chem?.current_stock ?? 0)) : stockDelta));

  await supabase.from("chemical_transactions").insert({ organization_id: organizationId, chemical_id, transaction_type, quantity, cost, notes });
  await supabase.from("chemicals").update({ current_stock: transaction_type === "adjustment" ? quantity : Number(chem?.current_stock ?? 0) + stockDelta }).eq("id", chemical_id);
  revalidatePath("/chemicals");
}

export async function deleteChemical(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("chemicals").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/chemicals");
}
