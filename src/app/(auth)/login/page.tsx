"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { seedDemoData } from "../demo/actions";
import { PLATFORM_NAME } from "@/lib/platform";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
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
      options: { data: { full_name: "Demo User", company_name: "Acme Home Services (Demo)" } },
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
      // Continue — dashboard will still render, just without sample data
      console.error(e);
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-6 font-bold text-xl">
          <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">{PLATFORM_NAME[0]}</span>
          {PLATFORM_NAME}
        </Link>
        <div className="card-padded">
          <h1 className="text-xl font-semibold mb-4">Log in</h1>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
            </div>
            <div>
              <label>Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>
          <p className="mt-4 text-sm text-gray-600 text-center">
            No account? <Link href="/signup" className="text-brand-600 font-medium">Sign up</Link>
          </p>
        </div>

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
      </div>
    </main>
  );
}
