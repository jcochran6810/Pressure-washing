"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin, logAdminAction, IMPERSONATE_COOKIE } from "@/lib/admin";

export async function startImpersonation(formData: FormData) {
  const orgId = String(formData.get("organization_id") || "").trim();
  if (!orgId) redirect("/admin/companies");
  const ctx = await requirePlatformAdmin();

  const jar = await cookies();
  jar.set(IMPERSONATE_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });

  await logAdminAction(ctx.userId, "impersonate.start", { kind: "organization", id: orgId });
  redirect("/dashboard");
}

export async function stopImpersonation() {
  const ctx = await requirePlatformAdmin();
  const jar = await cookies();
  const orgId = jar.get(IMPERSONATE_COOKIE)?.value ?? null;
  jar.delete(IMPERSONATE_COOKIE);
  if (orgId) {
    await logAdminAction(ctx.userId, "impersonate.stop", { kind: "organization", id: orgId });
  }
  redirect("/admin/companies");
}

export async function setOrgDisabled(formData: FormData) {
  const orgId = String(formData.get("organization_id") || "").trim();
  const disable = String(formData.get("disable") || "") === "1";
  const reason = String(formData.get("reason") || "").trim() || null;
  if (!orgId) return;
  const ctx = await requirePlatformAdmin();
  const supabase = await createClient();
  await supabase
    .from("organizations")
    .update({
      disabled_at: disable ? new Date().toISOString() : null,
      disabled_reason: disable ? reason : null,
    } as any)
    .eq("id", orgId);
  await logAdminAction(ctx.userId, disable ? "org.disable" : "org.enable", {
    kind: "organization",
    id: orgId,
    payload: { reason },
  });
  revalidatePath(`/admin/companies/${orgId}`);
  revalidatePath("/admin/companies");
}

export async function adjustSubscription(formData: FormData) {
  const orgId = String(formData.get("organization_id") || "").trim();
  const tier = String(formData.get("subscription_tier") || "").trim();
  const status = String(formData.get("subscription_status") || "").trim() || null;
  const trial_ends_at = String(formData.get("trial_ends_at") || "").trim() || null;
  if (!orgId) return;
  if (!["basic", "plus", "pro"].includes(tier)) return;
  const ctx = await requirePlatformAdmin();
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    subscription_tier: tier,
    subscription_status: status,
    updated_at: new Date().toISOString(),
  };
  if (trial_ends_at) patch.trial_ends_at = new Date(trial_ends_at).toISOString();
  await supabase.from("organizations").update(patch as any).eq("id", orgId);
  await logAdminAction(ctx.userId, "org.adjust_subscription", {
    kind: "organization",
    id: orgId,
    payload: { tier, status, trial_ends_at },
  });
  revalidatePath(`/admin/companies/${orgId}`);
}

export async function grantPlatformAdmin(formData: FormData) {
  const userId = String(formData.get("user_id") || "").trim();
  const notes = String(formData.get("notes") || "").trim() || null;
  if (!userId) return;
  const ctx = await requirePlatformAdmin();
  const supabase = await createClient();
  await supabase.from("platform_admins").upsert({
    user_id: userId,
    granted_by: ctx.userId,
    notes,
  } as any);
  await logAdminAction(ctx.userId, "admin.grant", { kind: "user", id: userId, payload: { notes } });
  revalidatePath("/admin/users");
}

export async function revokePlatformAdmin(formData: FormData) {
  const userId = String(formData.get("user_id") || "").trim();
  if (!userId) return;
  const ctx = await requirePlatformAdmin();
  if (userId === ctx.userId) return; // can't self-revoke
  const supabase = await createClient();
  await supabase.from("platform_admins").delete().eq("user_id", userId);
  await logAdminAction(ctx.userId, "admin.revoke", { kind: "user", id: userId });
  revalidatePath("/admin/users");
}
