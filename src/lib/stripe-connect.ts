// Stripe Connect (Standard) OAuth helpers. We send the org owner over to
// connect.stripe.com, they sign in / create a Standard account, and Stripe
// redirects back with a code we exchange for the connected acct_... id.

export function connectClientId(): string | null {
  return process.env.STRIPE_CONNECT_CLIENT_ID || null;
}

export function isConnectConfigured(): boolean {
  return Boolean(connectClientId() && process.env.STRIPE_SECRET_KEY);
}

export function connectAuthUrl(state: string, redirectUri: string): string {
  const cid = connectClientId();
  if (!cid) throw new Error("STRIPE_CONNECT_CLIENT_ID not set");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cid,
    scope: "read_write",
    redirect_uri: redirectUri,
    state,
    "stripe_user[business_type]": "company",
  });
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

// Application fee in cents the platform takes off each payment. Default 0.
// Operator can set STRIPE_PLATFORM_FEE_BPS to a basis-point value (e.g. 100 = 1%).
export function platformFeeAmount(invoiceTotalCents: number): number {
  const bps = Number(process.env.STRIPE_PLATFORM_FEE_BPS ?? 0);
  if (!Number.isFinite(bps) || bps <= 0) return 0;
  return Math.max(0, Math.round(invoiceTotalCents * (bps / 10_000)));
}
