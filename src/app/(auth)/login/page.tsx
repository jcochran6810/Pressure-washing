"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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

  return (
    <main className="min-h-screen grid place-items-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-6 font-bold text-xl">
          <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">S</span>
          Suds
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
      </div>
    </main>
  );
}
