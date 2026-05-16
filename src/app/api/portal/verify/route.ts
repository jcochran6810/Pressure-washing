import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!token) return NextResponse.redirect(new URL("/portal/login", url));

  const supabase = adminClient();
  const { data: session } = await supabase
    .from("customer_portal_sessions")
    .select("id, customer_id, organization_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!session) {
    const u = new URL("/portal/login", url);
    u.searchParams.set("error", "invalid");
    return NextResponse.redirect(u);
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    const u = new URL("/portal/login", url);
    u.searchParams.set("error", "expired");
    return NextResponse.redirect(u);
  }

  await supabase
    .from("customer_portal_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", session.id);

  // Set a long-lived HTTP-only cookie tying the browser to this portal session token.
  const cookieJar = await cookies();
  cookieJar.set("portal_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return NextResponse.redirect(new URL("/portal", url));
}
