"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/admin";

// Sign in via the standard Supabase password flow, then verify the user is a
// platform admin. Non-admins are signed back out so a non-admin's session
// doesn't accidentally carry across to /admin.
export async function signInAdmin(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const from = String(formData.get("from") || "/admin").trim() || "/admin";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    redirect(`/admin/login?error=invalid`);
  }

  const { data: admin } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!admin) {
    await supabase.auth.signOut();
    redirect(`/admin/login?error=not_admin`);
  }

  await logAdminAction(data.user.id, "admin.signin", { kind: "user", id: data.user.id });
  redirect(from.startsWith("/admin") ? from : "/admin");
}
