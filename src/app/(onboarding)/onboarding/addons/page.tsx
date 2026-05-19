import { redirect } from "next/navigation";
import { loadWizardContext } from "@/lib/onboarding-server";
import { mergeOnboardingData, setOnboardingStep } from "@/lib/onboarding";
import { OnboardingProgress, WizardCard } from "@/components/onboarding-progress";
import {
  TIERS,
  tierFor,
  INCLUDED_BUSINESS_TYPES,
  BUSINESS_TYPE_ADDON_MONTHLY_PRICE,
  businessTypeAddonCost,
} from "@/lib/billing";

export const dynamic = "force-dynamic";

const EXTRA_SEAT_PRICE = 8; // per seat / month — flat for Plus and Pro
const PREMIUM_TEMPLATES_PRICE = 5; // per month
const PRO_PACK_PRICE = 12; // per quota-pack (5k email + 1.5k SMS) / month

async function saveAddons(formData: FormData) {
  "use server";
  const ctx = await loadWizardContext("addons");
  const extraSeats = Math.max(0, Math.min(50, Number(formData.get("extra_seats") ?? 0)));
  const premiumTemplates = formData.get("premium_templates") === "on";
  const proPacks = Math.max(0, Math.min(20, Number(formData.get("pro_packs") ?? 0)));

  // Persist add-on intent in onboarding_data so the billing-checkout step
  // can mint the right Stripe line items. quota_addons is the canonical
  // org column for Pro packs, so we set that directly.
  await mergeOnboardingData(ctx.organizationId, {
    addons: {
      extra_seats: extraSeats,
      premium_templates: premiumTemplates,
      pro_packs: proPacks,
    },
  });
  await ctx.supabase
    .from("organizations")
    .update({ quota_addons: proPacks } as any)
    .eq("id", ctx.organizationId);

  await setOnboardingStep(ctx.organizationId, "billing");
  redirect("/onboarding/billing");
}

export default async function AddonsStep() {
  const ctx = await loadWizardContext("addons");
  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("subscription_tier, quota_addons, onboarding_data")
    .eq("id", ctx.organizationId)
    .maybeSingle();
  const { data: trades } = await ctx.supabase
    .from("organization_business_types")
    .select("business_type_id")
    .eq("organization_id", ctx.organizationId);

  const tier = tierFor((org as any)?.subscription_tier);
  const tradeCount = (trades ?? []).length;
  const extraTrades = Math.max(0, tradeCount - INCLUDED_BUSINESS_TYPES);
  const prevAddons = ((org as any)?.onboarding_data?.addons ?? {}) as {
    extra_seats?: number;
    premium_templates?: boolean;
    pro_packs?: number;
  };

  const showSeats = tier.id === "plus" || tier.id === "pro";
  const showTemplates = tier.id === "plus" || tier.id === "pro";
  const showProPacks = tier.id === "pro";

  return (
    <>
      <OnboardingProgress step="addons" />
      <WizardCard>
        <h1 className="text-xl font-semibold mb-1">Customize your plan</h1>
        <p className="text-sm text-gray-600 mb-5">
          Add-ons billed monthly alongside your {tier.label} plan. Change them anytime.
        </p>

        <form action={saveAddons} className="space-y-5">
          {extraTrades > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
              <p className="font-medium text-amber-900 mb-1">
                Extra trades: {extraTrades} × ${BUSINESS_TYPE_ADDON_MONTHLY_PRICE.toFixed(2)}/mo
                = <strong>+${businessTypeAddonCost(tradeCount).toFixed(2)}/mo</strong>
              </p>
              <p className="text-amber-800">
                You picked {tradeCount} trades. The first {INCLUDED_BUSINESS_TYPES} are included with every plan.
                Adjust your selection on the <a href="/onboarding/trades" className="underline">trades step</a>.
              </p>
            </div>
          )}

          {showSeats && (
            <div className="rounded-lg border p-4">
              <div className="flex items-baseline justify-between mb-1">
                <p className="font-medium">Extra user seats</p>
                <p className="text-sm text-gray-600">${EXTRA_SEAT_PRICE}/seat/mo</p>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                {tier.id === "pro"
                  ? "Pro includes unlimited seats. Skip this unless you want to pre-purchase seats for invoicing reasons."
                  : `${tier.label} includes ${tier.seats} seats. Add more for your crew.`}
              </p>
              <input
                type="number"
                name="extra_seats"
                min={0}
                max={50}
                defaultValue={prevAddons.extra_seats ?? 0}
                className="w-32"
              />
            </div>
          )}

          {showTemplates && (
            <label className="flex items-start gap-3 rounded-lg border p-4 cursor-pointer has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input
                type="checkbox"
                name="premium_templates"
                defaultChecked={prevAddons.premium_templates ?? false}
                className="mt-1"
              />
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">Premium forms & templates</p>
                  <p className="text-sm text-gray-600">${PREMIUM_TEMPLATES_PRICE}/mo</p>
                </div>
                <p className="text-sm text-gray-600">
                  Unlock the editable document-field library — customize which line-item details,
                  totals, signatures and payment terms appear on every estimate, invoice, and contract.
                </p>
              </div>
            </label>
          )}

          {showProPacks && (
            <div className="rounded-lg border p-4">
              <div className="flex items-baseline justify-between mb-1">
                <p className="font-medium">Messaging quota packs</p>
                <p className="text-sm text-gray-600">${PRO_PACK_PRICE}/pack/mo</p>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Each pack adds 5,000 emails + 1,500 SMS messages to your Pro monthly allowance.
                Stack as many as you need.
              </p>
              <input
                type="number"
                name="pro_packs"
                min={0}
                max={20}
                defaultValue={prevAddons.pro_packs ?? 0}
                className="w-32"
              />
            </div>
          )}

          {!showSeats && !showTemplates && !showProPacks && (
            <p className="text-sm text-gray-600">
              Nothing to add for the {tier.label} plan. You can still upgrade later from Settings.
            </p>
          )}

          <div className="rounded-md p-3 text-sm bg-gray-50 border border-gray-200">
            <p className="text-gray-700">
              Pricing summary: <strong>{tier.label} ${tier.monthlyPrice}/mo</strong>
              {extraTrades > 0 && <> + ${businessTypeAddonCost(tradeCount).toFixed(2)} extra trades</>}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              You won&rsquo;t be charged until your {TIERS[tier.id].label === "Basic" ? "trial" : "10-day trial"} ends.
            </p>
          </div>

          <div className="flex justify-between pt-2">
            <a href="/onboarding/tier" className="btn-secondary">← Back</a>
            <button type="submit" className="btn-primary">Continue →</button>
          </div>
        </form>
      </WizardCard>
    </>
  );
}
