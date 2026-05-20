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
  // If this estimate carries a deposit and the org has Stripe Connect, route
  // the customer through Stripe Checkout. Otherwise just return to the quote
  // page with the accepted state.
  const { data: est } = await supabase
    .from("estimates")
    .select("deposit_amount, deposit_paid, organizations(stripe_account_id)")
    .eq("approval_token", token)
    .maybeSingle();
  const needsDeposit =
    est &&
    !est.deposit_paid &&
    Number(est.deposit_amount ?? 0) > 0 &&
    (est.organizations as any)?.stripe_account_id;
  revalidatePath(`/quote/${token}`);
  if (needsDeposit) redirect(`/api/quote/${token}/deposit`);
  redirect(`/quote/${token}?approved=1`);
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

// Customer requested a revision rather than accept/decline. Append the
// request to the estimate's notes and leave status as 'sent' so the owner
// can edit and resend without losing the live link. Avoids needing a brand
// new status column at the DB level.
export async function requestRevision(token: string, formData: FormData) {
  const supabase = publicClient();
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) {
    redirect(`/quote/${token}?action=revise`);
  }
  const { data: est } = await supabase
    .from("estimates")
    .select("id, notes")
    .eq("approval_token", token)
    .maybeSingle();
  if (!est) {
    redirect(`/quote/${token}`);
  }
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const tag = `\n\n[Revision requested ${stamp}]\n${reason}`;
  const newNotes = ((est as any).notes ?? "") + tag;
  await supabase
    .from("estimates")
    .update({ notes: newNotes })
    .eq("approval_token", token);
  revalidatePath(`/quote/${token}`);
  redirect(`/quote/${token}?revised=1`);
}
