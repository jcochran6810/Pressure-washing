"use server";

import { getSessionAndOrgForMutation as getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createEquipment(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("equipment").insert({
    organization_id: organizationId,
    name: String(formData.get("name") || "").trim(),
    type: String(formData.get("type") || "").trim() || null,
    serial_number: String(formData.get("serial_number") || "").trim() || null,
    purchase_date: String(formData.get("purchase_date") || "") || null,
    purchase_price: Number(formData.get("purchase_price") || 0) || null,
    current_value: Number(formData.get("current_value") || 0) || null,
    last_service_date: String(formData.get("last_service_date") || "") || null,
    next_service_date: String(formData.get("next_service_date") || "") || null,
    hours_used: Number(formData.get("hours_used") || 0) || 0,
    notes: String(formData.get("notes") || "").trim() || null,
  });
  revalidatePath("/equipment");
  redirect("/equipment");
}

export async function deleteEquipment(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("equipment").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/equipment");
}
