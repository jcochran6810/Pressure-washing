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

export async function setOptOut(token: string, formData: FormData) {
  const channel = String(formData.get("channel") || "email") === "sms" ? "sms" : "email";
  const supabase = publicClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, organization_id")
    .eq("portal_token", token)
    .maybeSingle();
  if (!customer) redirect(`/u/${token}?done=1&channel=${channel}`);

  const patch =
    channel === "sms"
      ? { sms_opt_out: true, sms_opt_out_reason: "customer one-click unsubscribe", updated_at: new Date().toISOString() }
      : { email_opt_out: true, email_opt_out_reason: "customer one-click unsubscribe", updated_at: new Date().toISOString() };

  await supabase
    .from("customer_messaging_prefs")
    .upsert({
      customer_id: customer.id,
      organization_id: customer.organization_id,
      ...patch,
    } as any);

  redirect(`/u/${token}?done=1&channel=${channel}`);
}
