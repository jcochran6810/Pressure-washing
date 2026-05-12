"use server";

import { createServerClient } from "@supabase/ssr";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export async function approveQuote(token: string, formData: FormData) {
  const supabase = publicClient();
  const signature = String(formData.get("signature") || "").trim();
  await supabase.rpc("accept_estimate_by_token", {
    p_token: token,
    p_signature: signature || null,
  });
  revalidatePath(`/quote/${token}`);
  redirect(`/quote/${token}`);
}

export async function declineQuote(token: string, formData: FormData) {
  const supabase = publicClient();
  const reason = String(formData.get("reason") || "").trim() || null;
  await supabase
    .from("estimates")
    .update({ status: "declined", declined_reason: reason })
    .eq("approval_token", token);
  revalidatePath(`/quote/${token}`);
  redirect(`/quote/${token}`);
}
