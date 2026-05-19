// Setup-wizard state machine. The wizard runs after signup and walks the
// owner through business info → trades → tier → add-ons → billing →
// messaging → finish. State lives on organizations.onboarding_step plus
// onboarding_data jsonb (between-step scratch like the pending Stripe
// session id, requested SMS area code, etc.). When the user closes the
// tab and comes back, middleware sends them straight to their step.

import { createClient } from "@/lib/supabase/server";

export const ONBOARDING_STEPS = [
  "business",
  "trades",
  "tier",
  "addons",
  "billing",
  "messaging",
  "finish",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const STEP_PATHS: Record<OnboardingStep, string> = {
  business: "/onboarding/business",
  trades: "/onboarding/trades",
  tier: "/onboarding/tier",
  addons: "/onboarding/addons",
  billing: "/onboarding/billing",
  messaging: "/onboarding/messaging",
  finish: "/onboarding/finish",
};

export const STEP_LABELS: Record<OnboardingStep, string> = {
  business: "Business",
  trades: "Trades",
  tier: "Plan",
  addons: "Add-ons",
  billing: "Payment",
  messaging: "Email & SMS",
  finish: "Finish",
};

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const i = stepIndex(step);
  if (i < 0 || i >= ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[i + 1];
}

export function prevStep(step: OnboardingStep): OnboardingStep | null {
  const i = stepIndex(step);
  if (i <= 0) return null;
  return ONBOARDING_STEPS[i - 1];
}

export function isValidStep(step: string): step is OnboardingStep {
  return (ONBOARDING_STEPS as readonly string[]).includes(step);
}

export type OnboardingState = {
  step: OnboardingStep | null;
  completed: boolean;
  data: Record<string, unknown>;
};

export async function loadOnboardingState(organizationId: string): Promise<OnboardingState> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("onboarding_step, onboarding_completed_at, onboarding_data")
    .eq("id", organizationId)
    .maybeSingle();
  const row = data as any;
  return {
    step: row?.onboarding_step ?? null,
    completed: !!row?.onboarding_completed_at,
    data: (row?.onboarding_data as Record<string, unknown>) ?? {},
  };
}

export async function setOnboardingStep(
  organizationId: string,
  step: OnboardingStep,
  dataPatch?: Record<string, unknown>,
): Promise<void> {
  const supabase = await createClient();
  if (dataPatch && Object.keys(dataPatch).length) {
    // Merge into onboarding_data jsonb without clobbering existing keys.
    const current = await loadOnboardingState(organizationId);
    const merged = { ...current.data, ...dataPatch };
    await supabase
      .from("organizations")
      .update({ onboarding_step: step, onboarding_data: merged } as any)
      .eq("id", organizationId);
  } else {
    await supabase
      .from("organizations")
      .update({ onboarding_step: step } as any)
      .eq("id", organizationId);
  }
}

export async function mergeOnboardingData(
  organizationId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const supabase = await createClient();
  const current = await loadOnboardingState(organizationId);
  const merged = { ...current.data, ...patch };
  await supabase
    .from("organizations")
    .update({ onboarding_data: merged } as any)
    .eq("id", organizationId);
}

export async function completeOnboarding(organizationId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("organizations")
    .update({
      onboarding_step: null,
      onboarding_completed_at: new Date().toISOString(),
    } as any)
    .eq("id", organizationId);
}

// Some steps are optional depending on prior choices. The add-ons step
// can be skipped when the chosen tier has nothing to add (Basic with 1-2
// trades and no premium features available). The wizard checks this when
// rendering the next-step button so we don't dead-end the user.
export function isAddonsStepRequired(opts: {
  tier: string | null;
  tradeCount: number;
}): boolean {
  // Extra trades beyond 2 always cost — give the user a chance to confirm.
  if (opts.tradeCount > 2) return true;
  // Plus + Pro have seat / template / pack add-ons worth showing.
  if (opts.tier === "plus" || opts.tier === "pro") return true;
  // Basic with ≤ 2 trades has nothing to add on — skip.
  return false;
}
