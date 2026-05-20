"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLATFORM_NAME } from "@/lib/platform";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      // Brand-new account → wizard. The middleware would catch this too,
      // but routing directly skips a redirect hop.
      router.push("/onboarding/business");
      router.refresh();
    } else {
      setInfo("Check your email to confirm your account, then we'll walk you through setup.");
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-6 font-bold text-xl">
          <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">{PLATFORM_NAME[0]}</span>
          {PLATFORM_NAME}
        </Link>
        <div className="card-padded">
          <h1 className="text-xl font-semibold mb-1">Create your account</h1>
          <p className="text-sm text-gray-600 mb-4">
            You&rsquo;ll add business + trade details in the next few steps.
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label>Your name</label>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full" />
            </div>
            <div>
              <label>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
            </div>
            <div>
              <label>Password</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {info && <p className="text-sm text-green-700">{info}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>
          <p className="mt-4 text-sm text-gray-600 text-center">
            Already have an account? <Link href="/login" className="text-brand-600 font-medium">Log in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
