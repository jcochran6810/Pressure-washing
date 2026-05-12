"use client";

import { useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { createCardChargeIntent, confirmManualCardPayment } from "@/app/(app)/invoices/actions";

// Module-level memoized loadStripe call (Stripe.js best practice).
let _stripePromise: Promise<Stripe | null> | null = null;
function stripePromise(): Promise<Stripe | null> | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  if (!_stripePromise) _stripePromise = loadStripe(key);
  return _stripePromise;
}

/**
 * In-app virtual terminal for taking a credit/debit card payment manually.
 * The owner types the customer's card details into Stripe Elements; Stripe.js
 * confirms the PaymentIntent client-side, then a server action records the
 * payment and emails the receipt.
 */
export function CardChargeForm({
  invoiceId,
  defaultAmount,
}: {
  invoiceId: string;
  defaultAmount: number;
}) {
  const promise = stripePromise();
  const [amount, setAmount] = useState(defaultAmount);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!promise) {
    return (
      <p className="text-xs text-amber-700">
        Add <code className="bg-amber-50 px-1 rounded">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> to{" "}
        <code className="bg-amber-50 px-1 rounded">.env.local</code> to enable in-app card charging.
      </p>
    );
  }

  async function startCharge() {
    setBusy(true);
    setError(null);
    try {
      const result = await createCardChargeIntent(invoiceId, amount);
      setClientSecret(result.clientSecret);
      setIntentId(result.intentId);
    } catch (e: any) {
      setError(e?.message ?? "Could not start charge");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setClientSecret(null);
    setIntentId(null);
    setError(null);
  }

  if (!clientSecret) {
    return (
      <div className="space-y-2">
        <label className="text-sm">Amount to charge</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full"
        />
        <button
          type="button"
          disabled={busy || !(amount > 0)}
          onClick={startCharge}
          className="btn-primary w-full text-sm"
        >
          {busy ? "Starting…" : "Enter card details →"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="text-xs text-gray-500">
          You'll type the customer's card on the next screen. Stripe handles the card data — no card numbers
          touch our servers.
        </p>
      </div>
    );
  }

  return (
    <Elements stripe={promise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
      <CardFormInner invoiceId={invoiceId} intentId={intentId!} onCancel={reset} />
    </Elements>
  );
}

function CardFormInner({
  invoiceId,
  intentId,
  onCancel,
}: {
  invoiceId: string;
  intentId: string;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {},
      redirect: "if_required",
    });
    if (stripeError) {
      setError(stripeError.message ?? "Card declined.");
      setBusy(false);
      return;
    }
    try {
      await confirmManualCardPayment(invoiceId, intentId);
      // Reload to show the new payment + workflow state.
      window.location.reload();
    } catch (e: any) {
      setError(e?.message ?? "Payment was charged but recording it failed. Refresh and check.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <PaymentElement options={{ layout: "tabs" }} />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !stripe}
          onClick={submit}
          className="btn-primary flex-1 text-sm"
        >
          {busy ? "Charging…" : "Charge card"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary text-sm">
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
