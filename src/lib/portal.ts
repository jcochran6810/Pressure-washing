import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export async function getPortalSession() {
  const cookieJar = await cookies();
  const token = cookieJar.get("portal_session")?.value;
  if (!token) redirect("/portal/login");

  const supabase = adminClient();
  const { data: session } = await supabase
    .from("customer_portal_sessions")
    .select("id, token, customer_id, organization_id, expires_at, email")
    .eq("token", token)
    .maybeSingle();

  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    redirect("/portal/login");
  }

  const [{ data: customer }, { data: organization }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", session.customer_id).single(),
    supabase.from("organizations").select("*").eq("id", session.organization_id).single(),
  ]);

  return {
    supabase,
    session,
    customer: customer!,
    organization: organization!,
  };
}
