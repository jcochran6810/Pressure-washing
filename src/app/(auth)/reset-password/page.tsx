"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-6 font-bold text-xl">
          <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">S</span>
          Suds
        </Link>
        <div className="card-padded">
          <h1 className="text-xl font-semibold mb-2">New password</h1>
          {done ? (
            <p className="text-sm text-green-700">Password updated. Redirecting…</p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-3">Choose a strong password (at least 8 characters).</p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label>New password</label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full" autoComplete="new-password" autoFocus />
                </div>
                <div>
                  <label>Confirm password</label>
                  <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full" autoComplete="new-password" />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? "Updating…" : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
