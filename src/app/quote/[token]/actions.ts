"use server";

import { createServerClient } from "@supabase/ssr";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function publicClient(token: string) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll() { return []; }, setAll() {} },
      global: { headers: { "x-quote-token": token } },
    },
  );
}

export async function approveQuote(token: string, formData: FormData) {
  if (!token || token.length < 16) redirect("/");
  const supabase = publicClient(token);
  const signer = String(formData.get("signature") || "").trim();
  await supabase.rpc("accept_estimate_by_token", {
    p_token: token,
    p_signer: signer || null,
  });
  revalidatePath(`/quote/${token}`);
  redirect(`/quote/${token}`);
}

export async function declineQuote(token: string, formData: FormData) {
  if (!token || token.length < 16) redirect("/");
  const supabase = publicClient(token);
  const reason = String(formData.get("reason") || "").trim().slice(0, 1000) || null;
  await supabase.rpc("decline_estimate_by_token", {
    p_token: token,
    p_reason: reason,
  });
  revalidatePath(`/quote/${token}`);
  redirect(`/quote/${token}`);
}
