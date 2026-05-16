"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const appUrl = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-6 font-bold text-xl">
          <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">S</span>
          Suds
        </Link>
        <div className="card-padded">
          <h1 className="text-xl font-semibold mb-2">Reset password</h1>
          {sent ? (
            <>
              <p className="text-sm text-gray-600 mb-4">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
                Check your inbox and spam folder.
              </p>
              <Link href="/login" className="btn-secondary w-full text-center block">Back to log in</Link>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label>Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" autoComplete="username" autoFocus />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <p className="mt-4 text-sm text-gray-600 text-center">
                Remembered? <Link href="/login" className="text-brand-600 font-medium">Log in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
