"use server";

import { getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createLead(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("leads").insert({
    organization_id: organizationId,
    first_name: String(formData.get("first_name") || "").trim() || null,
    last_name: String(formData.get("last_name") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    address: String(formData.get("address") || "").trim() || null,
    source_id: (String(formData.get("source_id") || "") || null) as string | null,
    status: String(formData.get("status") || "new"),
    estimated_value: Number(formData.get("estimated_value") || 0) || null,
    notes: String(formData.get("notes") || "").trim() || null,
  });
  revalidatePath("/leads");
  redirect("/leads");
}

export async function setLeadStatus(id: string, status: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const patch: any = { status };
  if (status === "contacted") patch.contacted_at = new Date().toISOString();
  await supabase.from("leads").update(patch).eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/leads");
}

export async function convertLead(leadId: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", leadId).eq("organization_id", organizationId).single();
  if (!lead) throw new Error("Lead not found");

  const { data: customer } = await supabase.from("customers").insert({
    organization_id: organizationId,
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    phone: lead.phone,
    customer_type: "residential",
  }).select("id").single();
  if (!customer) throw new Error("Failed to create customer");

  await supabase.from("leads").update({ status: "won", converted_to_customer_id: customer.id }).eq("id", leadId);
  revalidatePath("/leads");
  redirect(`/customers/${customer.id}`);
}

export async function deleteLead(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("leads").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/leads");
}
