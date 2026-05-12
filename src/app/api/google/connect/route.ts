import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { googleAuthUrl } from "@/lib/google-drive";

export async function GET(request: Request) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local." },
      { status: 503 },
    );
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: profile } = await supabase.from("profiles").select("default_organization_id").eq("id", user.id).single();
  const orgId = profile?.default_organization_id;
  if (!orgId) return NextResponse.redirect(new URL("/dashboard", request.url));

  return NextResponse.redirect(googleAuthUrl(orgId));
}
