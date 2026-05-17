// Platform admin auth — distinct from organization roles.
// A platform admin is the SaaS operator (you), with rights to edit
// pricing tiers, view all orgs, and trigger broadcast emails.
//
// Source of truth: the platform_admins table. Helper checks via RPC.

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: admin } = await supabase
    .from("platform_admins")
    .select("user_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) {
    // Don't reveal whether the page exists; 404 from caller's perspective.
    redirect("/dashboard");
  }
  return { supabase, user, role: admin.role };
}
