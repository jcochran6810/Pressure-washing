// Platform-admin helpers. After the platform_admin_rls_bypass migration,
// is_platform_admin() in RLS lets admins read every org's data through
// the regular authenticated client — no service-role key required.
//
// All admin pages must call requirePlatformAdmin() first to gate access.
// All admin mutations should call logAdminAction() to append an audit row.

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const IMPERSONATE_COOKIE = "impersonate_org";

export type AdminContext = {
  userId: string;
  email: string | null;
};

export async function getCurrentUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

export async function requirePlatformAdmin(): Promise<AdminContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  const ok = await isPlatformAdmin(user.id);
  if (!ok) redirect("/dashboard");
  return { userId: user.id, email: user.email };
}

export async function logAdminAction(
  adminUserId: string,
  action: string,
  target?: { kind?: string; id?: string; payload?: Record<string, unknown> },
) {
  const supabase = await createClient();
  await supabase.from("admin_actions").insert({
    admin_user_id: adminUserId,
    action,
    target_kind: target?.kind ?? null,
    target_id: target?.id ?? null,
    payload: target?.payload ?? null,
  } as any);
}

export async function getImpersonatedOrgId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(IMPERSONATE_COOKIE)?.value ?? null;
}
