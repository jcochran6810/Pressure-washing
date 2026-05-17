import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { BRAND } from "@/lib/brand";
import { PlanPicker } from "./plan-picker";

export const dynamic = "force-dynamic";

export default async function OnboardingPaymentPage() {
  const { supabase, organization } = await getSessionAndOrg();

  // If they already have a subscription on file, skip the gate.
  if ((organization as any)?.subscription_stripe_id) {
    redirect("/dashboard");
  }

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("slug, name, description, monthly_amount, features, is_featured, seats_allowed, premium_templates_allowed")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl mb-4">
            <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">{BRAND.name.charAt(0)}</span>
            {BRAND.name}
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Pick your plan</h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            14-day free trial — you won&apos;t be charged until day 14. Add your card now so you don&apos;t lose access when the trial ends.
            Cancel any time during the trial and you pay nothing.
          </p>
        </div>

        <PlanPicker plans={(plans as any) ?? []} />

        <p className="text-center text-xs text-gray-500 mt-6">
          By continuing, you authorize us to charge your card the monthly subscription on the day your trial ends.
          You can update your card or cancel any time in Billing.
        </p>
        <p className="text-center text-xs text-gray-500 mt-2">
          <Link href="/legal/terms" className="text-brand-600 underline">Terms</Link>{" "}
          ·{" "}
          <Link href="/legal/refund" className="text-brand-600 underline">Refund policy</Link>
        </p>
      </div>
    </main>
  );
}
