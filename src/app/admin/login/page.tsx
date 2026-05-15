// Dedicated admin sign-in page. Lives at /admin/login — intentionally NOT
// linked from the main app. After successful sign-in we double-check the
// user is in platform_admins; if not, we sign them out and bounce back here
// with an error. Otherwise → /admin overview.

import { PLATFORM_NAME } from "@/lib/platform";
import { signInAdmin } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; from?: string }>;
}) {
  const { error, from } = (await searchParams) ?? {};
  return (
    <main className="min-h-screen grid place-items-center bg-slate-950 p-6">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
        <div className="text-center mb-5">
          <div className="text-red-400 text-xs tracking-widest uppercase">● restricted</div>
          <h1 className="text-xl font-bold text-white mt-1">{PLATFORM_NAME} admin</h1>
          <p className="text-xs text-slate-400 mt-1">Authorized personnel only.</p>
        </div>

        {error && (
          <div className="mb-4 p-2 rounded bg-red-950 border border-red-800 text-red-200 text-xs">
            {error === "not_admin"
              ? "That account isn't authorized for admin access."
              : error === "invalid"
                ? "Wrong email or password."
                : error}
          </div>
        )}

        <form action={signInAdmin} className="space-y-3">
          {from && <input type="hidden" name="from" value={from} />}
          <div>
            <label className="text-xs text-slate-400">Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              className="w-full bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Password</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <button className="btn-primary w-full">Sign in</button>
        </form>

        <p className="text-[10px] text-slate-600 text-center mt-5">All access is logged.</p>
      </div>
    </main>
  );
}
