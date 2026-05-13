"use server";

import { getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";

export async function updateOrganization(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("organizations").update({
    name: String(formData.get("name") || "").trim(),
    email: String(formData.get("email") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    website: String(formData.get("website") || "").trim() || null,
    address_line1: String(formData.get("address_line1") || "").trim() || null,
    address_line2: String(formData.get("address_line2") || "").trim() || null,
    city: String(formData.get("city") || "").trim() || null,
    state: String(formData.get("state") || "").trim() || null,
    postal_code: String(formData.get("postal_code") || "").trim() || null,
    tax_rate: Number(formData.get("tax_rate") || 0),
    currency: String(formData.get("currency") || "USD"),
    invoice_prefix: String(formData.get("invoice_prefix") || "INV"),
    estimate_prefix: String(formData.get("estimate_prefix") || "EST"),
    google_review_url: String(formData.get("google_review_url") || "").trim() || null,
    review_request_enabled: formData.get("review_request_enabled") === "on",
    appointment_reminder_hours: Number(formData.get("appointment_reminder_hours") || 24),
    recurring_reminder_months: Number(formData.get("recurring_reminder_months") || 12),
    updated_at: new Date().toISOString(),
  }).eq("id", organizationId);
  revalidatePath("/settings");
}

export async function disconnectGoogleDrive() {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("google_drive_connections").delete().eq("organization_id", organizationId);
  revalidatePath("/settings");
}

export async function setLinkedCalendar(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const calendar_id = String(formData.get("calendar_id") || "").trim() || null;
  const calendar_name = String(formData.get("calendar_name") || "").trim() || null;
  await supabase
    .from("google_drive_connections")
    .update({ calendar_id, calendar_name, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId);
  revalidatePath("/settings");
  revalidatePath("/calendar");
}
