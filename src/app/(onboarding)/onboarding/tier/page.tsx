import { redirect } from "next/navigation";
import { loadWizardContext } from "@/lib/onboarding-server";
import { setOnboardingStep, isAddonsStepRequired } from "@/lib/onboarding";
import { OnboardingProgress, WizardCard } from "@/components/onboarding-progress";
import { TIERS, TIER_ORDER, type Tier } from "@/lib/billing";

export const dynamic = "force-dynamic";

async function saveTier(formData: FormData) {
  "use server";
  const ctx = await loadWizardContext("tier");
  const tier = String(formData.get("tier") ?? "") as Tier;
  if (!TIER_ORDER.includes(tier)) throw new Error("Pick a plan.");

  await ctx.supabase
    .from("organizations")
    .update({ subscription_tier: tier } as any)
    .eq("id", ctx.organizationId);

  // Skip the add-ons step entirely for orgs whose tier + trade count
  // means there's nothing to add. Jump them straight to billing.
  const { count: tradeCount } = await ctx.supabase
    .from("organization_business_types")
    .select("business_type_id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId);
  const skipAddons = !isAddonsStepRequired({ tier, tradeCount: tradeCount ?? 0 });
  const nextStep = skipAddons ? "billing" : "addons";
  await setOnboardingStep(ctx.organizationId, nextStep);
  redirect(`/onboarding/${nextStep}`);
}

export default async function TierStep() {
  const ctx = await loadWizardContext("tier");
  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("subscription_tier")
    .eq("id", ctx.organizationId)
    .maybeSingle();
  const currentTier = ((org as any)?.subscription_tier as Tier | null) ?? "plus";

  return (
    <>
      <OnboardingProgress step="tier" />
      <WizardCard>
        <h1 className="text-xl font-semibold mb-1">Pick a plan</h1>
        <p className="text-sm text-gray-600 mb-5">
          Every plan starts with a 10-day free trial. Switch any time from Settings.
        </p>
        <form action={saveTier} className="space-y-3">
          {TIER_ORDER.map((id) => {
            const t = TIERS[id];
            return (
              <label
                key={id}
                className="flex items-start gap-3 border rounded-lg p-4 cursor-pointer has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
              >
                <input
                  type="radio"
                  name="tier"
                  value={id}
                  defaultChecked={currentTier === id}
                  className="mt-1"
                  required
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <p className="font-semibold text-base">{t.label}</p>
                    <p className="text-sm">
                      <span className="font-semibold">${t.monthlyPrice}</span>
                      <span className="text-gray-500">/mo</span>
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{t.description}</p>
                  <ul className="text-sm text-gray-700 space-y-0.5">
                    {t.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-brand-600">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </label>
            );
          })}

          <div className="flex justify-between pt-3">
            <a href="/onboarding/trades" className="btn-secondary">← Back</a>
            <button type="submit" className="btn-primary">Continue →</button>
          </div>
        </form>
      </WizardCard>
    </>
  );
}
