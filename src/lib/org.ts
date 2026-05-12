import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function getSessionAndOrg() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations:default_organization_id(*)")
    .eq("id", user.id)
    .single();

  if (!profile?.default_organization_id) {
    // Fallback — find first membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, organizations(*)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!membership) redirect("/login");
    return {
      supabase,
      user,
      profile,
      organizationId: membership.organization_id,
      organization: membership.organizations as any,
    };
  }

  return {
    supabase,
    user,
    profile,
    organizationId: profile.default_organization_id,
    organization: (profile as any).organizations,
  };
}
