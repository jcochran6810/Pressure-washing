"use server";

import { getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createJob(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const customer_id = String(formData.get("customer_id") || "");
  if (!customer_id) throw new Error("Customer required");

  const property_id = (String(formData.get("property_id") || "") || null) as string | null;
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const scheduled_start = String(formData.get("scheduled_start") || "") || null;
  const scheduled_end = String(formData.get("scheduled_end") || "") || null;
  const total_amount = Number(formData.get("total_amount") || 0);
  const status = String(formData.get("status") || "scheduled");

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({ organization_id: organizationId, customer_id, property_id, title, description, scheduled_start, scheduled_end, total_amount, status })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Schedule an appointment reminder using org's lead time
  if (scheduled_start) {
    const { data: org } = await supabase.from("organizations").select("appointment_reminder_hours").eq("id", organizationId).single();
    const hours = org?.appointment_reminder_hours ?? 24;
    const remindAt = new Date(scheduled_start);
    remindAt.setHours(remindAt.getHours() - hours);
    if (remindAt > new Date()) {
      await supabase.from("customer_reminders").insert({
        organization_id: organizationId,
        customer_id,
        job_id: job.id,
        kind: "appointment",
        channel: "email",
        scheduled_for: remindAt.toISOString(),
        message: `Reminder: your appointment is in ${hours} hours.`,
      });
    }
  }

  revalidatePath("/jobs");
  redirect(`/jobs`);
}

export async function setJobStatus(id: string, status: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const patch: any = { status };
  if (status === "in_progress") patch.actual_start = new Date().toISOString();
  if (status === "completed") patch.actual_end = new Date().toISOString();
  await supabase.from("jobs").update(patch).eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/jobs");
}

export async function deleteJob(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("jobs").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/jobs");
}
