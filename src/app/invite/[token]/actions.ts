"use server";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { syncStripeSeatQuantity } from "@/app/(app)/team/actions";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) throw new Error("Service role key required to accept invites");
  return createSbClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

export async function acceptInvite(token: string, formData: FormData) {
  if (!token || token.length < 32) redirect("/");
  const fullName = String(formData.get("full_name") || "").trim();
  const password = String(formData.get("password") || "");
  if (!fullName || password.length < 8) {
    throw new Error("Full name and a password of 8+ characters are required.");
  }

  const admin = adminClient();
  const { data: invite } = await admin
    .from("organization_invites")
    .select("email, role, organization_id, expires_at, accepted_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite || invite.accepted_at || invite.revoked_at || new Date(invite.expires_at).getTime() < Date.now()) {
    throw new Error("Invite is no longer valid.");
  }

  // Find or create the auth user with this email
  let userId: string | null = null;
  const { data: existing } = await admin.auth.admin.listUsers();
  const match = existing?.users?.find((u: any) => u.email?.toLowerCase() === invite.email.toLowerCase());
  if (match) {
    userId = match.id;
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !created.user) throw new Error(error?.message || "Failed to create account");
    userId = created.user.id;
  }

  if (!userId) throw new Error("Could not resolve user");

  // Add to org members
  await admin.from("organization_members").upsert({
    organization_id: invite.organization_id,
    user_id: userId,
    role: invite.role,
  });

  // Mark invite accepted
  await admin
    .from("organization_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("token", token);

  // Sync Stripe seat quantity
  const { data: org } = await admin
    .from("organizations")
    .select("*")
    .eq("id", invite.organization_id)
    .single();
  await syncStripeSeatQuantity(admin, invite.organization_id, org);

  redirect("/login?invite=accepted");
}
