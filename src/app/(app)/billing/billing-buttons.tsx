"use client";

import { useState } from "react";
import {
  startSubscription,
  openCustomerPortal,
  cancelSubscriptionAtPeriodEnd,
  resumeSubscription,
} from "./actions";

export function SubscribeButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setError(null);
    try {
      const { checkoutUrl } = await startSubscription();
      if (checkoutUrl) window.location.href = checkoutUrl;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button onClick={go} disabled={busy} className="btn-primary">
        {busy ? "Starting…" : "Subscribe — $49/mo"}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}

export function PortalButton({ hasCustomer }: { hasCustomer: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await openCustomerPortal();
      if (url) window.location.href = url;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button onClick={go} disabled={busy || !hasCustomer} className="btn-primary">
        {busy ? "Opening…" : "Manage payment method"}
      </button>
      {error && <p className="text-sm text-red-600 mt-2 w-full">{error}</p>}
    </>
  );
}

export function CancelButtons({ subscriptionId, cancelAtPeriodEnd }: { subscriptionId: string; cancelAtPeriodEnd: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!confirm("Cancel at end of current billing period? You'll keep access until then.")) return;
    setBusy(true); setError(null);
    try { await cancelSubscriptionAtPeriodEnd(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function resume() {
    setBusy(true); setError(null);
    try { await resumeSubscription(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (cancelAtPeriodEnd) {
    return (
      <>
        <button onClick={resume} disabled={busy} className="btn-secondary text-sm">
          {busy ? "…" : "Undo cancellation"}
        </button>
        {error && <p className="text-sm text-red-600 mt-2 w-full">{error}</p>}
      </>
    );
  }
  return (
    <>
      <button onClick={cancel} disabled={busy} className="btn-ghost text-red-600 text-sm">
        {busy ? "…" : "Cancel subscription"}
      </button>
      {error && <p className="text-sm text-red-600 mt-2 w-full">{error}</p>}
    </>
  );
}
