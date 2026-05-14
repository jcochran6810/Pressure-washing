"use server";

import { getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";

export async function createFollowUp(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await (supabase as any).from("follow_ups").insert({
    organization_id: organizationId,
    customer_id: String(formData.get("customer_id") || "") || null,
    kind: String(formData.get("kind") || "general"),
    due_date: String(formData.get("due_date") || new Date().toISOString().slice(0, 10)),
    notes: String(formData.get("notes") || "").trim() || null,
  });
  revalidatePath("/follow-ups");
}

export async function completeFollowUp(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await (supabase as any)
    .from("follow_ups")
    .update({ completed: true, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId);
  revalidatePath("/follow-ups");
}

export async function reopenFollowUp(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await (supabase as any)
    .from("follow_ups")
    .update({ completed: false, completed_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId);
  revalidatePath("/follow-ups");
}

export async function deleteFollowUp(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await (supabase as any).from("follow_ups").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/follow-ups");
}
