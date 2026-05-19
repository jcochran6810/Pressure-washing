import { redirect } from "next/navigation";
import { loadWizardContext } from "@/lib/onboarding-server";
import { completeOnboarding } from "@/lib/onboarding";
import { OnboardingProgress, WizardCard } from "@/components/onboarding-progress";
import {
  getDefaultsForTrades,
  getCustomFieldDefaultsForTrades,
} from "@/lib/trade-defaults";
import { tierFor } from "@/lib/billing";

export const dynamic = "force-dynamic";

async function finalizeSetup() {
  "use server";
  const ctx = await loadWizardContext("finish");

  // Selected trades drive the per-trade service catalog and custom-field
  // seeding. We only insert if the org has no services / custom_fields yet
  // — that way re-finishing (e.g. retried after a flake) is idempotent.
  const { data: trades } = await ctx.supabase
    .from("organization_business_types")
    .select("business_type_id")
    .eq("organization_id", ctx.organizationId);
  const tradeIds = (trades ?? []).map((t: any) => t.business_type_id as string);

  const { count: existingServiceCount } = await ctx.supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId);
  if ((existingServiceCount ?? 0) === 0) {
    const services = getDefaultsForTrades(tradeIds);
    if (services.length) {
      await ctx.supabase.from("services").insert(
        services.map((s) => ({
          organization_id: ctx.organizationId,
          name: s.name,
          description: s.description ?? null,
          default_price: s.default_price,
          pricing_unit: s.pricing_unit,
          category: s.category,
        })) as any,
      );
    }
  }

  const { count: existingFieldCount } = await ctx.supabase
    .from("custom_fields")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId);
  if ((existingFieldCount ?? 0) === 0) {
    const fields = getCustomFieldDefaultsForTrades(tradeIds);
    if (fields.length) {
      await ctx.supabase.from("custom_fields").insert(
        fields.map((f) => ({
          organization_id: ctx.organizationId,
          applies_to: f.applies_to,
          field_key: f.field_key,
          field_label: f.field_label,
          field_type: f.field_type,
          options: f.options ?? null,
          required: f.required ?? false,
          customer_visible: f.customer_visible ?? true,
        })) as any,
      );
    }
  }

  await completeOnboarding(ctx.organizationId);
  redirect("/dashboard?welcome=1");
}

export default async function FinishStep() {
  const ctx = await loadWizardContext("finish");
  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("name, subscription_tier")
    .eq("id", ctx.organizationId)
    .maybeSingle();
  const { data: trades } = await ctx.supabase
    .from("organization_business_types")
    .select("business_type_id, business_types(name)")
    .eq("organization_id", ctx.organizationId);

  const tier = tierFor((org as any)?.subscription_tier);
  const tradeIds = (trades ?? []).map((t: any) => t.business_type_id as string);
  const tradeNames = (trades ?? []).map(
    (t: any) => t.business_types?.name ?? t.business_type_id,
  );
  const previewServices = getDefaultsForTrades(tradeIds).slice(0, 8);
  const previewFields = getCustomFieldDefaultsForTrades(tradeIds).slice(0, 6);

  return (
    <>
      <OnboardingProgress step="finish" />
      <WizardCard>
        <h1 className="text-xl font-semibold mb-1">You&rsquo;re ready to roll</h1>
        <p className="text-sm text-gray-600 mb-5">
          Here&rsquo;s what we&rsquo;ll preload for <strong>{(org as any)?.name}</strong>.
          You can change everything from Settings and the Services page.
        </p>

        <div className="space-y-4 mb-6">
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Trades</p>
            <p className="text-sm">{tradeNames.join(", ") || "(none picked)"}</p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Plan
            </p>
            <p className="text-sm">{tier.label} · ${tier.monthlyPrice}/mo</p>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
              Services we&rsquo;ll preload
            </p>
            <ul className="text-sm text-gray-700 space-y-0.5">
              {previewServices.map((s) => (
                <li key={s.name}>• {s.name}</li>
              ))}
              {getDefaultsForTrades(tradeIds).length > 8 && (
                <li className="text-gray-500">
                  …plus {getDefaultsForTrades(tradeIds).length - 8} more
                </li>
              )}
              {previewServices.length === 0 && (
                <li className="text-gray-500">No defaults for these trades. You can add services manually.</li>
              )}
            </ul>
          </div>

          {previewFields.length > 0 && (
            <div className="rounded-lg border p-4">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                Custom fields we&rsquo;ll add
              </p>
              <ul className="text-sm text-gray-700 space-y-0.5">
                {previewFields.map((f) => (
                  <li key={`${f.applies_to}.${f.field_key}`}>
                    • {f.field_label} <span className="text-gray-400">({f.applies_to})</span>
                  </li>
                ))}
                {getCustomFieldDefaultsForTrades(tradeIds).length > 6 && (
                  <li className="text-gray-500">
                    …plus {getCustomFieldDefaultsForTrades(tradeIds).length - 6} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <form action={finalizeSetup}>
          <div className="flex justify-between">
            <a href="/onboarding/messaging" className="btn-secondary">← Back</a>
            <button type="submit" className="btn-primary">Finish &amp; go to dashboard →</button>
          </div>
        </form>
      </WizardCard>
    </>
  );
}
