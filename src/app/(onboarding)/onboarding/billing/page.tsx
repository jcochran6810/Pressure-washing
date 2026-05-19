import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { loadWizardContext } from "@/lib/onboarding-server";
import { setOnboardingStep } from "@/lib/onboarding";
import { OnboardingProgress, WizardCard } from "@/components/onboarding-progress";
import { tierFor, TRIAL_DAYS, businessTypeAddonCost, INCLUDED_BUSINESS_TYPES } from "@/lib/billing";
import { createWizardCheckoutSession } from "@/lib/billing-checkout";

export const dynamic = "force-dynamic";

async function startCheckout() {
  "use server";
  const ctx = await loadWizardContext("billing");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;
  const result = await createWizardCheckoutSession({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    origin,
  });
  if (result.ok) redirect(result.url);
  // On failure (no stripe key, missing price id) we fall through and the
  // page re-renders with the "skip for now" path.
}

async function skipBilling() {
  "use server";
  const ctx = await loadWizardContext("billing");
  // No card collected — trial still ticks. They'll hit the paywall when
  // it expires. We mark the step done and move on.
  await setOnboardingStep(ctx.organizationId, "messaging");
  redirect("/onboarding/messaging");
}

export default async function BillingStep() {
  const ctx = await loadWizardContext("billing");
  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("subscription_tier, stripe_customer_id, subscription_status, trial_ends_at")
    .eq("id", ctx.organizationId)
    .maybeSingle();
  const { count: tradeCount } = await ctx.supabase
    .from("organization_business_types")
    .select("business_type_id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId);

  const tier = tierFor((org as any)?.subscription_tier);
  const trades = tradeCount ?? 0;
  const extraTrades = Math.max(0, trades - INCLUDED_BUSINESS_TYPES);
  const tradeAddonCost = businessTypeAddonCost(trades);
  const stripeKeyConfigured = !!process.env.STRIPE_SECRET_KEY;
  const alreadyOnboarded = ((org as any)?.subscription_status === "active" || (org as any)?.subscription_status === "trialing");

  return (
    <>
      <OnboardingProgress step="billing" />
      <WizardCard>
        <h1 className="text-xl font-semibold mb-1">Add a payment method</h1>
        <p className="text-sm text-gray-600 mb-5">
          You won&rsquo;t be charged today — your card is saved and your free trial begins.
          We auto-charge when your {TRIAL_DAYS}-day trial ends; cancel anytime before then.
        </p>

        <div className="rounded-lg border p-4 mb-5 bg-gray-50">
          <p className="text-sm text-gray-700">
            <strong>{tier.label} plan</strong> · ${tier.monthlyPrice}/mo
            {extraTrades > 0 && (
              <> + ${tradeAddonCost.toFixed(2)} for {extraTrades} extra trade{extraTrades === 1 ? "" : "s"}</>
            )}
          </p>
        </div>

        {alreadyOnboarded ? (
          <form action={async () => {
            "use server";
            const c = await loadWizardContext("billing");
            await setOnboardingStep(c.organizationId, "messaging");
            redirect("/onboarding/messaging");
          }}>
            <p className="text-sm text-green-700 mb-4">✓ Card on file — your subscription is active.</p>
            <div className="flex justify-between">
              <a href="/onboarding/addons" className="btn-secondary">← Back</a>
              <button type="submit" className="btn-primary">Continue →</button>
            </div>
          </form>
        ) : stripeKeyConfigured ? (
          <div className="flex flex-col gap-3">
            <form action={startCheckout}>
              <button type="submit" className="btn-primary w-full">
                Open secure checkout →
              </button>
            </form>
            <form action={skipBilling}>
              <button type="submit" className="text-sm text-gray-500 hover:text-gray-700 w-full">
                Skip for now (trial only)
              </button>
            </form>
            <div className="flex justify-between pt-2">
              <a href="/onboarding/addons" className="btn-secondary">← Back</a>
            </div>
          </div>
        ) : (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 mb-4">
            <p className="font-medium">Stripe isn&rsquo;t configured in this environment.</p>
            <p className="mt-1">
              Skip for now — your {TRIAL_DAYS}-day trial still starts. The operator can wire Stripe later.
            </p>
            <form action={skipBilling} className="mt-3">
              <button type="submit" className="btn-primary">Skip for now</button>
            </form>
            <div className="flex justify-between pt-3">
              <a href="/onboarding/addons" className="btn-secondary">← Back</a>
            </div>
          </div>
        )}
      </WizardCard>
    </>
  );
}
