"use client";

import { useState } from "react";
import { startSubscription } from "@/app/(app)/billing/actions";

export function PlanPicker({ plans }: { plans: Array<any> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(slug: string) {
    setBusy(slug);
    setError(null);
    try {
      const { checkoutUrl } = await startSubscription(slug);
      if (checkoutUrl) window.location.href = checkoutUrl;
    } catch (e: any) {
      setBusy(null);
      setError(e.message);
    }
  }

  return (
    <>
      <div className={`grid gap-6 ${plans.length === 1 ? "max-w-md mx-auto" : plans.length === 2 ? "sm:grid-cols-2 max-w-3xl mx-auto" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {plans.map((plan) => {
          const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
          return (
            <div key={plan.slug} className={`card-padded relative ${plan.is_featured ? "ring-2 ring-brand-600 shadow-lg" : ""}`}>
              {plan.is_featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 badge bg-brand-600 text-white">Most popular</span>
              )}
              <h2 className="text-xl font-bold">{plan.name}</h2>
              {plan.description && <p className="text-sm text-gray-600 mt-1 mb-4">{plan.description}</p>}
              <div className="my-4">
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
              <button
                onClick={() => pick(plan.slug)}
                disabled={busy !== null}
                className={`w-full ${plan.is_featured ? "btn-primary" : "btn-secondary"}`}
              >
                {busy === plan.slug ? "Opening checkout…" : `Start 14-day trial of ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>
      {error && <p className="text-center text-sm text-red-600 mt-4">{error}</p>}
    </>
  );
}
