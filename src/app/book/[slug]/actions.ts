"use server";

import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";

function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

// Public lead-intake action. Anyone with the org's /book/<slug> URL can
// call this; we look up the org by slug, then insert into leads. Honeypot
// 'website' field rejects bots without telling them.
export async function submitLead(slug: string, formData: FormData) {
  // Honeypot — bots typically fill every text field.
  if (String(formData.get("website") || "").trim().length > 0) {
    redirect(`/book/${slug}?submitted=1`);
  }

  const first_name = String(formData.get("first_name") || "").trim();
  const last_name = String(formData.get("last_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const service_name = String(formData.get("service_name") || "").trim();
  const notes_raw = String(formData.get("notes") || "").trim();
  const preferred_date = String(formData.get("preferred_date") || "").trim();

  if (!first_name || !last_name || !email || !phone || !address) {
    redirect(`/book/${slug}?error=${encodeURIComponent("Please fill in your name, contact info, and service address.")}`);
  }

  const supabase = publicClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!org) redirect(`/book/${slug}?error=${encodeURIComponent("Booking page not found.")}`);

  // Try to attach to a matching "Website" lead source, fall back to null.
  const { data: source } = await supabase
    .from("lead_sources")
    .select("id")
    .eq("organization_id", org.id)
    .ilike("name", "%website%")
    .maybeSingle();

  const notes = [
    service_name ? `Service requested: ${service_name}` : null,
    preferred_date ? `Preferred date: ${preferred_date}` : null,
    notes_raw,
  ].filter(Boolean).join("\n\n");

  const { error } = await supabase.from("leads").insert({
    organization_id: org.id,
    first_name,
    last_name,
    email,
    phone,
    address,
    status: "new",
    source_id: source?.id ?? null,
    notes,
  } as any);

  if (error) {
    redirect(`/book/${slug}?error=${encodeURIComponent("Couldn't submit — please try again or call us directly.")}`);
  }

  redirect(`/book/${slug}?submitted=1`);
}
