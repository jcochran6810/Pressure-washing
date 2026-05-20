import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadOnboardingState, STEP_PATHS, type OnboardingStep } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

// /onboarding (no step) → bounce to whichever step the user is on. The
// middleware does this for app routes too; this handles bookmarks pointing
// at the bare /onboarding URL.
export default async function OnboardingIndex() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("default_organization_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgId = (profile as any)?.default_organization_id as string | null;
  if (!orgId) redirect("/login");
  const state = await loadOnboardingState(orgId);
  if (state.completed) redirect("/dashboard");
  const step = (state.step as OnboardingStep) ?? "business";
  redirect(STEP_PATHS[step]);
}
