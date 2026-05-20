// Server-only helpers shared by every wizard step page. Centralizes the
// "load user + org + onboarding state, redirect if you don't belong here"
// boilerplate so the step pages can focus on UI.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loadOnboardingState,
  type OnboardingState,
  type OnboardingStep,
  STEP_PATHS,
} from "@/lib/onboarding";

export type WizardContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  organizationId: string;
  state: OnboardingState;
};

// Loads the user's org and state, then enforces that the user is actually
// on the step they belong on. If the org's current step doesn't match the
// page they're loading, we silently redirect them — preventing skipping
// ahead via direct URL but allowing back-navigation to earlier steps.
export async function loadWizardContext(forStep: OnboardingStep): Promise<WizardContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("default_organization_id")
    .eq("id", user.id)
    .maybeSingle();
  let organizationId = (profile as any)?.default_organization_id as string | null;
  if (!organizationId) {
    const { data: member } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    organizationId = (member as any)?.organization_id ?? null;
  }
  if (!organizationId) redirect("/login");

  const state = await loadOnboardingState(organizationId);

  // Already completed → kick out of the wizard entirely.
  if (state.completed) redirect("/dashboard");

  // Trying to load a step ahead of where we are → bounce them to the right one.
  // We allow re-visiting earlier steps (e.g. user goes "back" from billing
  // to tier) but not jumping ahead.
  const { ONBOARDING_STEPS, stepIndex } = await import("@/lib/onboarding");
  const here = stepIndex(forStep);
  const actual = state.step ? stepIndex(state.step as OnboardingStep) : 0;
  if (here > actual) {
    redirect(STEP_PATHS[(state.step as OnboardingStep) ?? ONBOARDING_STEPS[0]]);
  }

  return { supabase, userId: user.id, organizationId, state };
}
