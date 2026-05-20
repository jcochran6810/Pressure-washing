import { redirect } from "next/navigation";
import { loadWizardContext } from "@/lib/onboarding-server";
import { setOnboardingStep } from "@/lib/onboarding";
import { OnboardingProgress, WizardCard } from "@/components/onboarding-progress";
import { BusinessTypesPicker } from "@/components/business-types-picker";

export const dynamic = "force-dynamic";

async function saveTrades(formData: FormData) {
  "use server";
  const ctx = await loadWizardContext("trades");
  const ids = formData.getAll("business_type_id").map(String).filter(Boolean);
  const primary = String(formData.get("primary_business_type_id") ?? "") || ids[0] || null;

  if (ids.length === 0) throw new Error("Pick at least one trade.");
  if (!primary || !ids.includes(primary)) throw new Error("Primary trade must be one of your selections.");

  // Rewrite the join table to exactly the selected set.
  await ctx.supabase
    .from("organization_business_types")
    .delete()
    .eq("organization_id", ctx.organizationId);
  await ctx.supabase
    .from("organization_business_types")
    .insert(
      ids.map((id) => ({
        organization_id: ctx.organizationId,
        business_type_id: id,
        is_primary: id === primary,
      })) as any,
    );

  // Keep the singular column in sync with the primary trade so legacy
  // code that reads it (welcome banner, default form config) stays right.
  await ctx.supabase
    .from("organizations")
    .update({ business_type_id: primary } as any)
    .eq("id", ctx.organizationId);

  await setOnboardingStep(ctx.organizationId, "tier");
  redirect("/onboarding/tier");
}

export default async function TradesStep() {
  const ctx = await loadWizardContext("trades");

  const { data: types } = await ctx.supabase
    .from("business_types")
    .select("id, name")
    .eq("active", true)
    .order("sort_order");
  const { data: selected } = await ctx.supabase
    .from("organization_business_types")
    .select("business_type_id, is_primary")
    .eq("organization_id", ctx.organizationId);

  const initialSelected = (selected ?? []).map((s: any) => s.business_type_id);
  const initialPrimary = (selected ?? []).find((s: any) => s.is_primary)?.business_type_id ?? null;

  return (
    <>
      <OnboardingProgress step="trades" />
      <WizardCard>
        <h1 className="text-xl font-semibold mb-1">What trades do you offer?</h1>
        <p className="text-sm text-gray-600 mb-5">
          We&rsquo;ll preload service catalogs, custom fields, and tools for the trades you pick.
          Your first 2 trades are included; each additional trade is $3.99/mo.
        </p>
        <form action={saveTrades}>
          <BusinessTypesPicker
            options={(types ?? []) as { id: string; name: string }[]}
            initialSelected={initialSelected}
            initialPrimary={initialPrimary}
          />
        </form>
      </WizardCard>
    </>
  );
}
