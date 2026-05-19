"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "suds:cookie-consent";

export function CookieConsent() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      const choice = localStorage.getItem(STORAGE_KEY);
      if (!choice) setHidden(false);
    } catch {
      // localStorage unavailable (e.g., privacy mode) — never show.
    }
  }, []);

  function decide(choice: "accept" | "reject") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, at: Date.now() }));
    } catch {}
    setHidden(true);
    // Broadcast so any conditional analytics can opt in/out.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cookie-consent", { detail: choice }));
    }
  }

  if (hidden) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:bottom-4 sm:right-4 z-50 max-w-sm bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-sm">
      <p className="mb-2 font-medium">Cookies</p>
      <p className="text-gray-600 text-xs mb-3">
        We use essential cookies to keep you signed in. Optional analytics cookies help us improve the product.
        See our <Link href="/legal/cookies" className="text-brand-600 underline">Cookie Policy</Link>.
      </p>
      <div className="flex gap-2">
        <button onClick={() => decide("reject")} className="btn-ghost text-xs flex-1">Reject optional</button>
        <button onClick={() => decide("accept")} className="btn-primary text-xs flex-1">Accept all</button>
      </div>
    </div>
  );
}
