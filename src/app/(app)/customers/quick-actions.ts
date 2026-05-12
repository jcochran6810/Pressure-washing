"use server";

import { getSessionAndOrg } from "@/lib/org";

export async function quickCreateCustomer(formData: FormData): Promise<{ id: string } | { error: string }> {
  const { supabase, organizationId } = await getSessionAndOrg();
  const first_name = String(formData.get("first_name") || "").trim() || null;
  const last_name = String(formData.get("last_name") || "").trim() || null;
  const company_name = String(formData.get("company_name") || "").trim() || null;
  if (!first_name && !last_name && !company_name) {
    return { error: "Provide at least a name or company." };
  }
  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: organizationId,
      first_name,
      last_name,
      company_name,
      email: String(formData.get("email") || "").trim() || null,
      phone: String(formData.get("phone") || "").trim() || null,
      customer_type: String(formData.get("customer_type") || "residential"),
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create customer" };
  return { id: data.id };
}
