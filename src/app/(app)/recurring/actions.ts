"use server";

import { getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { advanceDate, type RecurrenceKind } from "@/lib/recurring";

export async function createRecurring(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const customer_id = String(formData.get("customer_id") || "");
  const property_id = String(formData.get("property_id") || "") || null;
  const service_id = String(formData.get("service_id") || "") || null;
  const title = String(formData.get("title") || "").trim();
  if (!customer_id || !title) throw new Error("Customer and title required");
  await (supabase as any).from("recurring_jobs").insert({
    organization_id: organizationId,
    customer_id,
    property_id,
    service_id,
    title,
    description: String(formData.get("description") || "").trim() || null,
    recurrence_kind: String(formData.get("recurrence_kind") || "weekly"),
    recurrence_interval: Number(formData.get("recurrence_interval") || 1),
    next_service_date: String(formData.get("next_service_date") || new Date().toISOString().slice(0, 10)),
    default_price: Number(formData.get("default_price") || 0),
    duration_minutes: Number(formData.get("duration_minutes") || 60),
    notes: String(formData.get("notes") || "").trim() || null,
  });
  revalidatePath("/recurring");
}

export async function updateRecurring(id: string, formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await (supabase as any)
    .from("recurring_jobs")
    .update({
      title: String(formData.get("title") || "").trim(),
      description: String(formData.get("description") || "").trim() || null,
      recurrence_kind: String(formData.get("recurrence_kind") || "weekly"),
      recurrence_interval: Number(formData.get("recurrence_interval") || 1),
      next_service_date: String(formData.get("next_service_date") || ""),
      default_price: Number(formData.get("default_price") || 0),
      duration_minutes: Number(formData.get("duration_minutes") || 60),
      active: formData.get("active") === "on",
      notes: String(formData.get("notes") || "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId);
  revalidatePath("/recurring");
}

export async function deleteRecurring(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await (supabase as any).from("recurring_jobs").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/recurring");
}

// Materialise a single occurrence: spawn a Job from the recurring template,
// roll next_service_date forward by the recurrence interval, stash a back-ref.
export async function materialiseRecurring(id: string, _formData?: FormData): Promise<void> {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: rec } = await (supabase as any)
    .from("recurring_jobs")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!rec) throw new Error("Recurring job not found");

  const scheduledStart = new Date(rec.next_service_date + "T09:00:00");
  const scheduledEnd = new Date(scheduledStart.getTime() + (rec.duration_minutes ?? 60) * 60_000);

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      organization_id: organizationId,
      customer_id: rec.customer_id,
      property_id: rec.property_id,
      title: rec.title,
      description: rec.description,
      status: "scheduled",
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      total_amount: Number(rec.default_price ?? 0),
      duration_minutes: rec.duration_minutes ?? 60,
      recurring_job_id: rec.id,
    } as any)
    .select("id")
    .single();
  if (error || !job) throw new Error(error?.message || "Failed to spawn job");

  const next = advanceDate(rec.next_service_date, rec.recurrence_kind as RecurrenceKind, rec.recurrence_interval ?? 1);
  await (supabase as any)
    .from("recurring_jobs")
    .update({ last_service_date: rec.next_service_date, next_service_date: next, updated_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/recurring");
  revalidatePath("/jobs");
  revalidatePath("/calendar");
}
