import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { IMPERSONATE_COOKIE, isPlatformAdmin } from "@/lib/admin";

export async function getSessionAndOrg() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const jar = await cookies();
  const impersonateOrgId = jar.get(IMPERSONATE_COOKIE)?.value;
  const userIsAdmin = await isPlatformAdmin(user.id);

  if (impersonateOrgId && userIsAdmin) {
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", impersonateOrgId)
      .maybeSingle();
    if (org) {
      return {
        supabase,
        user,
        profile: null as any,
        organizationId: impersonateOrgId,
        organization: org as any,
      };
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations:default_organization_id(*)")
    .eq("id", user.id)
    .single();

  let organizationId: string;
  let organization: any;

  if (!profile?.default_organization_id) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, organizations(*)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!membership) redirect("/login");
    organizationId = membership.organization_id;
    organization = membership.organizations as any;
  } else {
    organizationId = profile.default_organization_id;
    organization = (profile as any).organizations;
  }

  // Suspended account gate. Platform admins bypass so they can investigate
  // and re-enable. Everyone else gets bounced to a static page.
  if (organization?.disabled_at && !userIsAdmin) {
    redirect("/disabled");
  }

  return { supabase, user, profile, organizationId, organization };
}

