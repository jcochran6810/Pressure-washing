// One-click unsubscribe via the portal token. Customer arrives here from the
// List-Unsubscribe header (or a link in the email footer) and confirms opt-out.

import { createServerClient } from "@supabase/ssr";
import { PLATFORM_NAME } from "@/lib/platform";
import { setOptOut } from "./actions";

export const dynamic = "force-dynamic";

function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ done?: string; channel?: string }>;
}) {
  const { token } = await params;
  const { done, channel: targetChannel = "email" } = (await searchParams) ?? {};
  const supabase = publicClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, email, phone, organization_id, organizations(name)")
    .eq("portal_token", token)
    .maybeSingle();

  if (!customer) {
    return (
      <main className="min-h-screen grid place-items-center p-6 bg-gray-50">
        <div className="card-padded max-w-md text-center">
          <h1 className="text-xl font-bold">Link invalid</h1>
          <p className="text-gray-600 mt-2">This unsubscribe link doesn't match a known recipient.</p>
        </div>
      </main>
    );
  }

  const org = customer.organizations as any;

  if (done === "1") {
    return (
      <main className="min-h-screen grid place-items-center p-6 bg-gray-50">
        <div className="card-padded max-w-md text-center">
          <h1 className="text-xl font-bold text-green-700">You're unsubscribed</h1>
          <p className="text-gray-600 mt-2">
            We won't send you {targetChannel === "sms" ? "SMS messages" : "marketing emails"} from {org?.name} anymore.
            Transactional messages (estimates you've requested, invoices you owe) may still be sent.
          </p>
          <p className="text-xs text-gray-400 mt-4">Powered by {PLATFORM_NAME}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-gray-50">
      <div className="card-padded max-w-md text-center">
        <h1 className="text-xl font-bold">Unsubscribe from {org?.name}?</h1>
        <p className="text-gray-600 mt-3 text-sm">
          Recipient: <strong>{targetChannel === "sms" ? customer.phone : customer.email}</strong>
        </p>
        <form action={setOptOut.bind(null, token)} className="mt-5 space-y-3">
          <input type="hidden" name="channel" value={targetChannel} />
          <button className="btn-danger w-full">Confirm unsubscribe</button>
        </form>
        <p className="text-xs text-gray-400 mt-4">Powered by {PLATFORM_NAME}</p>
      </div>
    </main>
  );
}
