"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!acceptedTerms) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, company_name: companyName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setInfo("Check your email to confirm your account.");
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-6 font-bold text-xl">
          <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">S</span>
          Suds
        </Link>
        <div className="card-padded">
          <h1 className="text-xl font-semibold mb-4">Create your account</h1>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label>Your name</label>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full" />
            </div>
            <div>
              <label>Company name</label>
              <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full" placeholder="e.g. Crystal Clear Pressure Washing" />
            </div>
            <div>
              <label>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
            </div>
            <div>
              <label>Password</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full" />
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I agree to the{" "}
                <Link href="/legal/terms" target="_blank" className="text-brand-600 underline">Terms of Service</Link>{" "}
                and{" "}
                <Link href="/legal/privacy" target="_blank" className="text-brand-600 underline">Privacy Policy</Link>.
              </span>
            </label>
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
