"use server";

import { getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { encryptString } from "@/lib/crypto";
import { TIERS, stripePriceIdFor, type Tier } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

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

// Multi-trade setter with monthly-billing lifecycle:
//   * Selecting a trade adds it immediately — the dropdown for new
//     estimates / invoices shows it on the next render.
//   * Unselecting a trade does NOT remove the row mid-cycle. We mark it
//     `cancel_at_period_end=true` so the org keeps access (services, custom
//     fields, dropdown options) until billing_period_end, then a sweep
//     cron / next-bill webhook removes it. Until then, re-checking the
//     same trade un-cancels with no extra charge.
//   * Newly added trades are billed on the next monthly invoice via the
//     standard quantity update on the Stripe subscription. We surface the
//     amount in the UI; actual proration is handled by Stripe.
export async function setBusinessTypes(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const selected = formData.getAll("business_type_id").map((v) => String(v).trim()).filter(Boolean);
  if (selected.length === 0) return;
  const primary = String(formData.get("primary_business_type_id") || selected[0]).trim();
  const unique = Array.from(new Set(selected));
  if (!unique.includes(primary)) unique.unshift(primary);

  const { data: existing } = await (supabase as any)
    .from("organization_business_types")
    .select("business_type_id, cancel_at_period_end, drops_at")
    .eq("organization_id", organizationId);
  const existingIds = new Set<string>((existing ?? []).map((r: any) => r.business_type_id));
  const existingActive = new Set<string>((existing ?? [])
    .filter((r: any) => !r.cancel_at_period_end)
    .map((r: any) => r.business_type_id));

  // Compute billing_period_end (defaults to "first of next month" so the
  // operator can still drop trades without a Stripe webhook wired up).
  const { data: orgRow } = await supabase
    .from("organizations")
    .select("billing_period_end")
    .eq("id", organizationId)
    .single();
  const periodEnd = (orgRow as any)?.billing_period_end
    ? new Date((orgRow as any).billing_period_end)
    : firstOfNextMonth();

  // Drop the join rows we'd never insert/update; insert anything new,
  // un-cancel anything that was scheduled to drop, mark removed ones as
  // cancel_at_period_end.
  const toInsert: any[] = [];
  const toUncancel: string[] = [];
  for (const id of unique) {
    if (!existingIds.has(id)) {
      toInsert.push({
        organization_id: organizationId,
        business_type_id: id,
        is_primary: id === primary,
        cancel_at_period_end: false,
        added_at: new Date().toISOString(),
        drops_at: null,
      });
    } else {
      toUncancel.push(id);
    }
  }
  const toCancel: string[] = [];
  for (const id of existingActive) {
    if (!unique.includes(id)) toCancel.push(id);
  }

  if (toInsert.length) {
    await (supabase as any).from("organization_business_types").insert(toInsert);
  }
  if (toUncancel.length) {
    await (supabase as any)
      .from("organization_business_types")
      .update({ cancel_at_period_end: false, drops_at: null })
      .eq("organization_id", organizationId)
      .in("business_type_id", toUncancel);
  }
  if (toCancel.length) {
    await (supabase as any)
      .from("organization_business_types")
      .update({ cancel_at_period_end: true, drops_at: periodEnd.toISOString() })
      .eq("organization_id", organizationId)
      .in("business_type_id", toCancel);
  }

  // Re-flag the primary (this can flip even when membership doesn't).
  await (supabase as any)
    .from("organization_business_types")
    .update({ is_primary: false })
    .eq("organization_id", organizationId);
  await (supabase as any)
    .from("organization_business_types")
    .update({ is_primary: true })
    .eq("organization_id", organizationId)
    .eq("business_type_id", primary);

  // Keep the singular primary column in sync so legacy reads still work.
  await supabase
    .from("organizations")
    .update({ business_type_id: primary, updated_at: new Date().toISOString() } as any)
    .eq("id", organizationId);

  revalidatePath("/dashboard");
  revalidatePath("/services");
  revalidatePath("/settings");
  revalidatePath("/estimates/new");
  revalidatePath("/invoices/new");
  savedRedirect("business_type");
}

function firstOfNextMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}

// Back-compat shim for any callers still pointing at the old single-type
// setter — accepts the same single-input form and routes through the new
// multi-trade path.
export async function setBusinessType(formData: FormData) {
  return setBusinessTypes(formData);
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

// Pick a subscription tier from the Settings page. When Stripe is fully
// configured (secret key + price ID for the chosen tier) this hands off to
// Stripe Checkout — that's the real billing path. When it isn't (local dev,
// self-hosted, env vars not yet set) we just write the tier directly to the
// org so the user can still pick a plan and see the confirmation.
export async function pickTier(formData: FormData) {
  const tier = String(formData.get("tier") || "").trim() as Tier;
  if (!(tier in TIERS)) return;

  const stripe = getStripe();
  const priceId = stripePriceIdFor(tier);
  if (stripe && priceId) {
    redirect(`/api/billing/checkout?tier=${tier}`);
  }

  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase
    .from("organizations")
    .update({ subscription_tier: tier, updated_at: new Date().toISOString() } as any)
    .eq("id", organizationId);
  savedRedirect(`tier_${tier}`);
}

// Logo upload — writes to the public 'branding' bucket at <org-id>/logo.<ext>
// and stores the public URL on organizations.logo_url. The image is used on
// generated PDFs (estimates, invoices) and on the customer portal header.
export async function uploadLogo(formData: FormData) {
  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) {
    redirect(`/settings?error=${encodeURIComponent("No file selected")}`);
  }
  if (file.size > LOGO_MAX_BYTES) {
    redirect(`/settings?error=${encodeURIComponent("Logo too large — keep under 2 MB.")}`);
  }
  if (!LOGO_ALLOWED.has(file.type)) {
    redirect(`/settings?error=${encodeURIComponent("Use PNG, JPEG, WebP, or SVG.")}`);
  }
  const { supabase, organizationId } = await getSessionAndOrg();
  const ext = file.type === "image/svg+xml" ? "svg" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${organizationId}/logo.${ext}`;
  const { error: upErr } = await supabase.storage.from("branding").upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "60",
  });
  if (upErr) {
    redirect(`/settings?error=${encodeURIComponent("Upload failed: " + upErr.message)}`);
  }
  const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
  // Cache-bust so the new logo shows up immediately after re-upload.
  const logo_url = `${pub.publicUrl}?v=${Date.now()}`;
  await supabase
    .from("organizations")
    .update({ logo_url, updated_at: new Date().toISOString() } as any)
    .eq("id", organizationId);
  savedRedirect("logo");
}

export async function removeLogo() {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const url = (organization as any)?.logo_url as string | null;
  if (url) {
    // The path lives after the bucket name; trim the query string from cache-bust.
    const m = url.match(/\/branding\/([^?]+)/);
    if (m?.[1]) {
      await supabase.storage.from("branding").remove([m[1]]);
    }
  }
  await supabase
    .from("organizations")
    .update({ logo_url: null, updated_at: new Date().toISOString() } as any)
    .eq("id", organizationId);
  savedRedirect("logo_removed");
}

// Public booking widget URL slug. /book/<slug>. Validates a-z0-9- only,
// rejects collisions, length 3-40.
export async function setOrgSlug(formData: FormData) {
  const raw = String(formData.get("slug") || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(raw)) {
    redirect(`/settings?error=${encodeURIComponent("Slug must be 3-40 chars, lowercase letters/numbers/dashes only.")}`);
  }
  const { supabase, organizationId } = await getSessionAndOrg();
  const { error } = await supabase
    .from("organizations")
    .update({ slug: raw, updated_at: new Date().toISOString() } as any)
    .eq("id", organizationId);
  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message.includes("duplicate") ? "That slug is taken — pick another." : error.message)}`);
  }
  savedRedirect("slug");
}
