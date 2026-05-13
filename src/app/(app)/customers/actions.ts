"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionAndOrg } from "@/lib/org";
import { customerSchema, parseForm } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createCustomer(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const customerType = String(formData.get("customer_type") || "residential");
  const data = parseForm(customerSchema, formData);

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      organization_id: organizationId,
      customer_type: customerType,
      first_name: data.first_name ?? null,
      last_name: data.last_name ?? null,
      company_name: data.company_name ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      mobile_phone: data.mobile_phone ?? null,
      notes: data.notes ?? null,
      lead_source: data.lead_source ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Optional property
  const address_line1 = String(formData.get("address_line1") || "").trim();
  if (address_line1) {
    await supabase.from("properties").insert({
      organization_id: organizationId,
      customer_id: customer.id,
      address_line1,
      address_line2: String(formData.get("address_line2") || "").trim() || null,
      city: String(formData.get("city") || "").trim() || null,
      state: String(formData.get("state") || "").trim() || null,
      postal_code: String(formData.get("postal_code") || "").trim() || null,
    });
  }

  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(id: string, formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const data = parseForm(customerSchema, formData);
  const payload = {
    customer_type: String(formData.get("customer_type") || "residential"),
    first_name: data.first_name ?? null,
    last_name: data.last_name ?? null,
    company_name: data.company_name ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    mobile_phone: data.mobile_phone ?? null,
    notes: data.notes ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("customers").update(payload).eq("id", id).eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function addProperty(customerId: string, formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { error } = await supabase.from("properties").insert({
    organization_id: organizationId,
    customer_id: customerId,
    nickname: String(formData.get("nickname") || "").trim() || null,
    address_line1: String(formData.get("address_line1") || "").trim(),
    address_line2: String(formData.get("address_line2") || "").trim() || null,
    city: String(formData.get("city") || "").trim() || null,
    state: String(formData.get("state") || "").trim() || null,
    postal_code: String(formData.get("postal_code") || "").trim() || null,
    square_footage: Number(formData.get("square_footage")) || null,
    stories: Number(formData.get("stories")) || null,
    notes: String(formData.get("notes") || "").trim() || null,
    gate_code: String(formData.get("gate_code") || "").trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/customers/${customerId}`);
}

export async function deleteCustomer(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("customers").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/customers");
  redirect("/customers");
}
