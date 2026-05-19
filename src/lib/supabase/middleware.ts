import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value }) =>
        request.cookies.set(name, value),
      );
      supabaseResponse = NextResponse.next({ request });
      cookiesToSet.forEach(({ name, value, options }) =>
        // Keep users signed in for a year unless they explicitly sign out.
        supabaseResponse.cookies.set(name, value, {
          ...options,
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
        }),
      );
    },
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieMethods },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/auth") ||
    path.startsWith("/quote/") ||
    path.startsWith("/gallery/") ||
    path.startsWith("/review/") ||
    path.startsWith("/legal") ||
    path.startsWith("/api/stripe/webhook") ||
    path.startsWith("/api/cron/");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Onboarding redirect. If the signed-in user's org hasn't finished the
  // setup wizard, force them into it. We allow them to stay in the wizard
  // routes themselves, sign out, and hit account-level / public stuff.
  // Everything under (app)/* funnels them back into the wizard.
  if (user && !isPublic && !path.startsWith("/onboarding") && !path.startsWith("/api/billing/checkout")) {
    // Find the user's org. Profile.default_organization_id is the canonical
    // pointer; if it isn't set we fall back to any membership.
    const { data: profile } = await supabase
      .from("profiles")
      .select("default_organization_id")
      .eq("id", user.id)
      .maybeSingle();
    let orgId = (profile as any)?.default_organization_id as string | null;
    if (!orgId) {
      const { data: member } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      orgId = (member as any)?.organization_id ?? null;
    }
    if (orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("onboarding_step, onboarding_completed_at")
        .eq("id", orgId)
        .maybeSingle();
      const completed = !!(org as any)?.onboarding_completed_at;
      const step = ((org as any)?.onboarding_step as string | null) ?? "business";
      if (!completed) {
        const url = request.nextUrl.clone();
        url.pathname = `/onboarding/${step}`;
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
