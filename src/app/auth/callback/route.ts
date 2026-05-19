import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const fallback = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);

    // After confirming the email link the user lands here. If their org
    // hasn't finished setup, route them into the wizard so the middleware
    // doesn't immediately bounce them again. Cleaner than a double-redirect.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("default_organization_id")
        .eq("id", user.id)
        .maybeSingle();
      const orgId = (profile as any)?.default_organization_id as string | null;
      if (orgId) {
        const { data: org } = await supabase
          .from("organizations")
          .select("onboarding_step, onboarding_completed_at")
          .eq("id", orgId)
          .maybeSingle();
        if (!(org as any)?.onboarding_completed_at) {
          const step = ((org as any)?.onboarding_step as string | null) ?? "business";
          return NextResponse.redirect(`${origin}/onboarding/${step}`);
        }
      }
    }
  }
  return NextResponse.redirect(`${origin}${fallback}`);
}
