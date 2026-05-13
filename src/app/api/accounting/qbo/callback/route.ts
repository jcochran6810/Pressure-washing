import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/qbo";
import { getSessionAndOrg } from "@/lib/org";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;

  if (errorParam) {
    return NextResponse.redirect(`${appUrl}/settings?qbo=error&msg=${encodeURIComponent(errorParam)}`);
  }
  if (!code || !realmId) {
    return NextResponse.redirect(`${appUrl}/settings?qbo=error&msg=missing_params`);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("qbo_state")?.value;
  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${appUrl}/settings?qbo=error&msg=state_mismatch`);
  }

  try {
    const tokens = await exchangeCode(code);
    const { supabase, organizationId } = await getSessionAndOrg();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const env = (process.env.QBO_ENVIRONMENT === "sandbox" ? "sandbox" : "production");
    await (supabase as any).from("qbo_connections").upsert({
      organization_id: organizationId,
      realm_id: realmId,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: expiresAt,
      environment: env,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const res = NextResponse.redirect(`${appUrl}/settings?qbo=connected`);
    res.cookies.delete("qbo_state");
    return res;
  } catch (e) {
    return NextResponse.redirect(`${appUrl}/settings?qbo=error&msg=${encodeURIComponent((e as Error).message)}`);
  }
}
