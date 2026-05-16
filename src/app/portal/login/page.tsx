"use client";

import Link from "next/link";
import { useState } from "react";

export default function PortalLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/portal/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setLoading(false);
      // Always show success state to avoid email enumeration
      setSent(true);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j?.dev_link) {
          // In dev with no email configured we surface the link directly
          setError(`Dev mode — email not configured. Use this link: ${j.dev_link}`);
        }
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || "Something went wrong");
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-6 font-bold text-xl">
          <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">S</span>
          Customer portal
        </Link>
        <div className="card-padded">
          <h1 className="text-xl font-semibold mb-2">Sign in</h1>
          {sent ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                If we have a customer record for <strong>{email}</strong>, we sent you a sign-in link.
                Open it on this device to view your invoices, estimates, and service history.
              </p>
              {error && <p className="text-xs text-amber-700 break-all">{error}</p>}
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">Enter your email and we&apos;ll send you a one-click sign-in link.</p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label>Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" autoFocus />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? "Sending…" : "Send sign-in link"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
