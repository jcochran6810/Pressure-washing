// Start of the Stripe Connect OAuth flow. Redirects the org owner to Stripe's
// authorize page; on return /api/stripe/callback exchanges the code and stores
// the connected account id on organizations.stripe_account_id.

import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";
import { connectAuthUrl, isConnectConfigured } from "@/lib/stripe-connect";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isConnectConfigured()) {
    return NextResponse.json(
      { error: "Stripe Connect not configured. Set STRIPE_CONNECT_CLIENT_ID and STRIPE_SECRET_KEY." },
      { status: 503 },
    );
  }
  const { organizationId } = await getSessionAndOrg();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const redirectUri = `${appUrl}/api/stripe/callback`;
  return NextResponse.redirect(connectAuthUrl(organizationId, redirectUri));
}
