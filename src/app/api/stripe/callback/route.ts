// Stripe Connect OAuth callback. Exchanges the auth code for a connected
// account id (Standard accounts return stripe_user_id = acct_...) and stores
// it on the org so subsequent Stripe API calls can scope to that account.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.redirect(new URL("/settings?stripe=not_configured", request.url));

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  if (errorParam) {
    return NextResponse.redirect(new URL(`/settings?stripe=denied`, request.url));
  }
  if (!code || !state) return NextResponse.redirect(new URL("/settings?stripe=error", request.url));

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // The state we sent was the org id — verify the user belongs to that org.
  const { data: member } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("organization_id", state)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || !["owner", "admin"].includes(member.role as string)) {
    return NextResponse.redirect(new URL("/settings?stripe=unauthorized", request.url));
  }
  const organization_id = state;

  // Exchange the code. Stripe Connect Standard returns the connected user's
  // account id in stripe_user_id. We don't need to keep the access_token —
  // platform calls use { stripeAccount: acct_... } on every request.
  let stripeUserId: string;
  try {
    const result: any = await (stripe.oauth as any).token({
      grant_type: "authorization_code",
      code,
    });
    stripeUserId = result.stripe_user_id;
    if (!stripeUserId) throw new Error("No stripe_user_id returned");
  } catch (e: any) {
    return NextResponse.redirect(
      new URL(`/settings?stripe=error&msg=${encodeURIComponent(e.message || "exchange failed")}`, request.url),
    );
  }

  // Pull account details so the Settings card can show the email + country.
  let email: string | null = null;
  let country: string | null = null;
  try {
    const acct = await stripe.accounts.retrieve(stripeUserId);
    email = acct.email ?? null;
    country = acct.country ?? null;
  } catch {
    /* not fatal */
  }

  await supabase
    .from("organizations")
    .update({
      stripe_account_id: stripeUserId,
      stripe_connect_status: "connected",
      stripe_connect_email: email,
      stripe_connect_country: country,
      stripe_connect_connected_at: new Date().toISOString(),
    } as any)
    .eq("id", organization_id);

  return NextResponse.redirect(new URL("/settings?stripe=connected", request.url));
}
