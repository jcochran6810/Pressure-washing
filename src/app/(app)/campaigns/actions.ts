"use server";

import { getSessionAndOrgForMutation as getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createCampaign(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("campaigns").insert({
    organization_id: organizationId,
    name: String(formData.get("name") || "").trim(),
    channel: String(formData.get("channel") || "").trim() || null,
    start_date: String(formData.get("start_date") || "") || null,
    end_date: String(formData.get("end_date") || "") || null,
    budget: Number(formData.get("budget") || 0) || null,
    spent: Number(formData.get("spent") || 0) || 0,
    notes: String(formData.get("notes") || "").trim() || null,
  });
  revalidatePath("/campaigns");
  redirect("/campaigns");
}

export async function deleteCampaign(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("campaigns").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/campaigns");
}
