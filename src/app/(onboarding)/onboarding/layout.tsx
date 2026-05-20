import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLATFORM_NAME } from "@/lib/platform";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">{PLATFORM_NAME[0]}</span>
            <span>{PLATFORM_NAME}</span>
          </Link>
          <form action="/auth/signout" method="post">
            <button className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
          </form>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {children}
        <p className="text-xs text-gray-500 text-center mt-4">
          Need help? Email support and we&rsquo;ll walk you through it.
        </p>
      </div>
    </div>
  );
}
