// User returned from Stripe Connect onboarding. Check whether the account
// is fully enabled and reflect that in the organization record.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSessionAndOrg } from "@/lib/org";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const stripe = getStripe();
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const accountId = organization?.stripe_connect_account_id as string | null;

  if (!stripe || !accountId) {
    return NextResponse.redirect(new URL("/settings?stripe_connect=missing", request.url));
  }

  const account = await stripe.accounts.retrieve(accountId);
  const status =
    account.charges_enabled && account.payouts_enabled
      ? "active"
      : account.details_submitted
      ? "pending"
      : "onboarding";

  await supabase.from("organizations").update({
    stripe_connect_status: status,
    stripe_connect_connected_at: status === "active" ? new Date().toISOString() : organization?.stripe_connect_connected_at,
  }).eq("id", organizationId);

  await logAudit({
    organizationId,
    action: status === "active" ? "connect" : "update",
    entityType: "integration",
    entityLabel: "Stripe Connect",
    after: { status },
  });

  return NextResponse.redirect(new URL(`/settings?stripe_connect=${status}`, request.url));
}
