import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export default async function PricingPage() {
  const supabase = publicClient();
  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("slug, name, description, monthly_amount, annual_amount, features, is_featured")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="inline-block w-7 h-7 rounded-lg bg-brand-600 text-white grid place-items-center text-sm">{BRAND.name.charAt(0)}</span>
            {BRAND.name}
          </Link>
          <nav className="text-sm flex gap-3">
            <Link href="/help" className="text-gray-600 hover:text-gray-900">Help</Link>
            <Link href="/login" className="text-gray-600 hover:text-gray-900">Log in</Link>
            <Link href="/signup" className="btn-primary text-sm">Start free</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold mb-3">Simple pricing</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            14-day free trial. No credit card to start. Cancel any time.
          </p>
        </div>

        {(!plans || plans.length === 0) ? (
          <p className="text-center text-gray-500">Pricing is being updated. Check back shortly.</p>
        ) : (
          <div className={`grid gap-6 ${plans.length === 1 ? "max-w-md mx-auto" : plans.length === 2 ? "sm:grid-cols-2 max-w-3xl mx-auto" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {plans.map((plan) => {
              const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
              return (
                <div
                  key={plan.slug}
                  className={`card-padded relative ${plan.is_featured ? "ring-2 ring-brand-600 shadow-lg" : ""}`}
                >
                  {plan.is_featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge bg-brand-600 text-white">Most popular</span>
                  )}
                  <h2 className="text-xl font-bold">{plan.name}</h2>
                  {plan.description && <p className="text-sm text-gray-600 mt-1 mb-4">{plan.description}</p>}
                  <div className="my-5">
                    <span className="text-4xl font-bold">${Number(plan.monthly_amount).toFixed(0)}</span>
                    <span className="text-gray-500 ml-1">/ month</span>
                  </div>
                  <ul className="space-y-2 text-sm mb-6">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" className={`block text-center ${plan.is_featured ? "btn-primary" : "btn-secondary"}`}>
                    Start free trial
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-10">
          Have questions about the plan that&apos;s right for you?{" "}
          <a href="mailto:hello@yourdomain.com" className="text-brand-600">Email us</a>.
          Read our <Link href="/legal/refund" className="text-brand-600">refund policy</Link>.
        </p>
      </main>
    </div>
  );
}
