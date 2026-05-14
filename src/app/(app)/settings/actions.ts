"use server";

import { getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { encryptString } from "@/lib/crypto";

// Redirect back to /settings with a ?saved=<key> flag so the page can render a
// confirmation Notice. Keys map to user-facing copy on the settings page.
function savedRedirect(key: string): never {
  revalidatePath("/settings");
  redirect(`/settings?saved=${encodeURIComponent(key)}`);
}

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
  savedRedirect("org");
}

export async function disconnectGoogleDrive() {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("google_drive_connections").delete().eq("organization_id", organizationId);
  savedRedirect("google_disconnected");
}

export async function saveMessagingCredentials(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const PLACEHOLDER = "••••••";
  const raw = (key: string) => String(formData.get(key) || "").trim();

  // Treat the masked placeholder as "no change" so re-saving the form without
  // re-typing the key doesn't wipe the stored value.
  const newResendKey = raw("resend_api_key");
  const newTelnyxKey = raw("telnyx_api_key");
  const newTelnyxFrom = raw("telnyx_from_number");

  const patch: Record<string, unknown> = {
    organization_id: organizationId,
    resend_from: raw("resend_from") || null,
    updated_at: new Date().toISOString(),
  };

  if (newResendKey && !newResendKey.startsWith(PLACEHOLDER)) {
    patch.resend_api_key = encryptString(newResendKey);
  } else if (!newResendKey) {
    patch.resend_api_key = null;
  }

  if (newTelnyxKey && !newTelnyxKey.startsWith(PLACEHOLDER)) {
    patch.telnyx_api_key = encryptString(newTelnyxKey);
  } else if (!newTelnyxKey) {
    patch.telnyx_api_key = null;
  }

  if (newTelnyxFrom) {
    patch.telnyx_from_number = encryptString(newTelnyxFrom);
  } else {
    patch.telnyx_from_number = null;
  }

  await supabase.from("org_messaging_credentials").upsert(patch as any);
  savedRedirect("messaging_creds");
}

export async function setMessagingMode(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const mode = String(formData.get("messaging_mode") || "platform") === "byoc" ? "byoc" : "platform";
  await supabase
    .from("org_messaging_credentials")
    .upsert({
      organization_id: organizationId,
      messaging_mode: mode,
      updated_at: new Date().toISOString(),
    } as any);
  savedRedirect("messaging_mode");
}

export async function clearMessagingCredentials() {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase
    .from("org_messaging_credentials")
    .update({
      resend_api_key: null,
      resend_from: null,
      telnyx_api_key: null,
      telnyx_from_number: null,
      messaging_mode: "platform",
      updated_at: new Date().toISOString(),
    } as any)
    .eq("organization_id", organizationId);
  savedRedirect("messaging_cleared");
}

export async function disconnectStripeConnect() {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const acct = (organization as any)?.stripe_account_id;
  if (acct) {
    try {
      const { getStripe } = await import("@/lib/stripe");
      const stripe = getStripe();
      if (stripe) {
        await (stripe.oauth as any).deauthorize({
          client_id: process.env.STRIPE_CONNECT_CLIENT_ID,
          stripe_user_id: acct,
        });
      }
    } catch (e) {
      // Stripe may already consider us disconnected — proceed to clear local state.
      console.error("Stripe deauthorize:", e);
    }
  }
  await supabase
    .from("organizations")
    .update({
      stripe_account_id: null,
      stripe_connect_status: null,
      stripe_connect_email: null,
      stripe_connect_country: null,
      stripe_connect_connected_at: null,
    } as any)
    .eq("id", organizationId);
  savedRedirect("stripe_disconnected");
}

export async function setBusinessType(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const business_type_id = String(formData.get("business_type_id") || "").trim();
  if (!business_type_id) return;
  await supabase
    .from("organizations")
    .update({ business_type_id, updated_at: new Date().toISOString() } as any)
    .eq("id", organizationId);
  revalidatePath("/dashboard");
  savedRedirect("business_type");
}

export async function setLinkedCalendar(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const calendar_id = String(formData.get("calendar_id") || "").trim() || null;
  const calendar_name = String(formData.get("calendar_name") || "").trim() || null;
  await supabase
    .from("google_drive_connections")
    .update({ calendar_id, calendar_name, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId);
  revalidatePath("/calendar");
  savedRedirect("calendar");
}
