"use client";

import { useState } from "react";
import { createContractSubscription, cancelContractSubscription } from "@/app/(app)/contracts/subscription-actions";

export function SubscriptionPanel({
  contractId,
  subscriptionId,
  defaultAmount,
  cadenceMonths,
  stripeConnectStatus,
}: {
  contractId: string;
  subscriptionId: string | null;
  defaultAmount: number;
  cadenceMonths: number;
  stripeConnectStatus: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  async function startSubscription() {
    setError(null);
    setBusy(true);
    try {
      const result = await createContractSubscription(contractId);
      setCheckoutUrl(result.checkoutUrl ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!confirm("Cancel the recurring Stripe subscription? The customer won't be charged again.")) return;
    setError(null);
    setBusy(true);
    try {
      await cancelContractSubscription(contractId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-padded mb-4">
      <h2 className="font-semibold mb-2">Recurring billing</h2>
      {subscriptionId ? (
        <>
          <p className="text-sm text-green-700 mb-2">
            ✓ Active Stripe subscription · <code className="text-xs">{subscriptionId}</code>
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Stripe will charge the customer ${defaultAmount.toFixed(2)} every {cadenceMonths} month(s).
            Each successful charge is recorded as a payment.
          </p>
          <button onClick={stop} disabled={busy} className="btn-ghost text-red-600 text-xs">
            {busy ? "Cancelling…" : "Cancel subscription"}
          </button>
        </>
      ) : checkoutUrl ? (
        <>
          <p className="text-sm text-gray-600 mb-2">
            Send this link to the customer — once they enter a card, the subscription will activate.
          </p>
          <a href={checkoutUrl} target="_blank" rel="noopener" className="btn-primary text-sm break-all">
            Open Stripe Checkout ↗
          </a>
          <p className="text-xs text-gray-500 mt-2 break-all">{checkoutUrl}</p>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-2">
            Optionally bill this contract via Stripe (auto-charge the customer&apos;s card every cadence).
            Requires <strong>Stripe Connect</strong> active and a default amount on this contract.
          </p>
          {stripeConnectStatus && stripeConnectStatus !== "active" && (
            <p className="text-xs text-amber-700 mb-2">Stripe Connect status: {stripeConnectStatus}</p>
          )}
          <button onClick={startSubscription} disabled={busy} className="btn-secondary text-sm">
            {busy ? "Setting up…" : "Set up Stripe subscription"}
          </button>
        </>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
