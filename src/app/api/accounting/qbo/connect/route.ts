import { NextResponse } from "next/server";
import { qboAuthUrl, qboConfigured } from "@/lib/qbo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  if (!qboConfigured()) {
    return NextResponse.redirect(`${origin}/settings?qbo=not_configured`);
  }
  const state = crypto.randomUUID();
  const url = qboAuthUrl(state)!;
  const res = NextResponse.redirect(url);
  res.cookies.set("qbo_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
