"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { seedDemoData } from "../demo/actions";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<{ factorId: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    // Check whether MFA is required (aal2)
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel && aal.nextLevel !== aal.currentLevel && aal.nextLevel === "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (totp) {
        setLoading(false);
        setMfa({ factorId: totp.id });
        return;
      }
    }
    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfa) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: mfa.factorId });
    if (chalErr || !challenge) {
      setLoading(false);
      setError(chalErr?.message || "Failed to start MFA challenge");
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: mfa.factorId,
      challengeId: challenge.id,
      code: mfaCode.replace(/\s/g, ""),
    });
    if (verifyErr) {
      setLoading(false);
      setError(verifyErr.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleDemo() {
    setError(null);
    setDemoLoading(true);
    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signInAnonymously({
      options: { data: { full_name: "Demo User", company_name: "Crystal Clear Pressure Washing (Demo)" } },
    });
    if (authErr) {
      setDemoLoading(false);
      setError(
        authErr.message.includes("disabled") || authErr.message.includes("not enabled")
          ? "Anonymous sign-in isn't enabled on this Supabase project. Enable it in Authentication → Providers → Anonymous, then try again."
          : authErr.message,
      );
      return;
    }
    try {
      await seedDemoData();
    } catch (e: any) {
      console.error(e);
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-6 font-bold text-xl">
          <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">S</span>
          Suds
        </Link>
        <div className="card-padded">
          {!mfa ? (
            <>
              <h1 className="text-xl font-semibold mb-4">Log in</h1>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label>Email</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" autoComplete="username" />
                </div>
                <div>
                  <label>Password</label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full" autoComplete="current-password" />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? "Logging in…" : "Log in"}
                </button>
              </form>
              <div className="mt-3 flex items-center justify-between text-sm">
                <Link href="/forgot-password" className="text-brand-600 hover:underline">Forgot password?</Link>
                <Link href="/signup" className="text-brand-600 hover:underline">Sign up</Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold mb-4">Two-factor code</h1>
              <p className="text-sm text-gray-600 mb-3">Enter the 6-digit code from your authenticator app.</p>
              <form onSubmit={handleMfa} className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9 ]{6,8}"
                  required
                  autoFocus
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="w-full text-center text-lg tracking-widest"
                  placeholder="000 000"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? "Verifying…" : "Verify"}
                </button>
                <button type="button" onClick={() => { setMfa(null); setMfaCode(""); setError(null); }} className="btn-ghost w-full text-sm">
                  Cancel
                </button>
              </form>
            </>
          )}
        </div>

        {!mfa && (
          <div className="mt-4 card-padded">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <span className="flex-1 h-px bg-gray-200" />
              <span>or try it out</span>
              <span className="flex-1 h-px bg-gray-200" />
            </div>
            <button
              type="button"
              onClick={handleDemo}
              disabled={demoLoading}
              className="btn-secondary w-full"
            >
              {demoLoading ? "Loading demo…" : "Try the demo — no signup"}
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Spins up a sandbox account pre-loaded with sample customers, jobs, invoices, and expenses.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
