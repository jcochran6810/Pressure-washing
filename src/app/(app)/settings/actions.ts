"use server";

import { getSessionAndOrg } from "@/lib/org";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function updateOrganization(formData: FormData) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const update = {
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
  };
  await supabase.from("organizations").update(update).eq("id", organizationId);
  await logAudit({
    organizationId,
    action: "update",
    entityType: "organization",
    entityId: organizationId,
    entityLabel: organization?.name ?? null,
    before: organization,
    after: update,
  });
  revalidatePath("/settings");
}

export async function uploadLogo(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return;
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!allowed.includes(file.type)) {
    throw new Error("Logo must be PNG, JPEG, WebP, or SVG.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Logo must be under 2 MB.");
  }
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${organizationId}/logo-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadErr } = await supabase.storage.from("logos").upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadErr) throw new Error(uploadErr.message);
  const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
  await supabase.from("organizations").update({ logo_url: pub.publicUrl }).eq("id", organizationId);
  await logAudit({
    organizationId,
    action: "update",
    entityType: "organization",
    entityId: organizationId,
    entityLabel: "Logo uploaded",
    after: { logo_url: pub.publicUrl },
  });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function removeLogo() {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("organizations").update({ logo_url: null }).eq("id", organizationId);
  await logAudit({
    organizationId,
    action: "update",
    entityType: "organization",
    entityId: organizationId,
    entityLabel: "Logo removed",
  });
  revalidatePath("/settings");
}

export async function disconnectGoogleDrive() {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("google_drive_connections").delete().eq("organization_id", organizationId);
  await logAudit({
    organizationId,
    action: "disconnect",
    entityType: "integration",
    entityLabel: "Google Drive",
  });
  revalidatePath("/settings");
}
