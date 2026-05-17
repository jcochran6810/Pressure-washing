import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { BRAND } from "@/lib/brand";
import { acceptInvite } from "./actions";

export const dynamic = "force-dynamic";

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 32) return <NotFound />;
  const supabase = adminClient();
  const { data: invite } = await supabase
    .from("organization_invites")
    .select("email, role, expires_at, accepted_at, revoked_at, organizations(name)")
    .eq("token", token)
    .maybeSingle();

  if (!invite || invite.accepted_at || invite.revoked_at || new Date(invite.expires_at).getTime() < Date.now()) {
    return <NotFound />;
  }

  const accept = acceptInvite.bind(null, token);
  const orgName = (invite.organizations as any)?.name ?? "the organization";

  return (
    <main className="min-h-screen grid place-items-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 mb-6 font-bold text-xl">
          <span className="inline-block w-8 h-8 rounded-lg bg-brand-600 text-white grid place-items-center">{BRAND.name.charAt(0)}</span>
          {BRAND.name}
        </Link>
        <div className="card-padded">
          <h1 className="text-xl font-semibold mb-2">Join {orgName}</h1>
          <p className="text-sm text-gray-600 mb-4">
            You&apos;ve been invited to join <strong>{orgName}</strong> as a <strong>{invite.role}</strong>.
            Already have an account at <strong>{invite.email}</strong>? Sign in below to accept.
          </p>
          <form action={accept} className="space-y-3">
            <p className="text-xs text-gray-500">
              We&apos;ll sign you up if needed, or attach this invite to your existing account.
            </p>
            <input name="full_name" required placeholder="Your full name" className="w-full" />
            <input name="password" type="password" minLength={8} required placeholder="Password (min 8 characters)" className="w-full" />
            <button type="submit" className="btn-primary w-full">Accept invite</button>
          </form>
          <p className="mt-3 text-xs text-gray-500">
            Existing user? <Link href="/login" className="text-brand-600">Sign in first</Link> with {invite.email}, then re-open this link.
          </p>
        </div>
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center px-4 bg-gray-50">
      <div className="card-padded text-center max-w-sm">
        <h1 className="text-xl font-bold">Invite unavailable</h1>
        <p className="text-gray-600 mt-2">
          This invite is invalid, expired, or has already been used. Ask your team lead to send a new one.
        </p>
      </div>
    </main>
  );
}
