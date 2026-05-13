"use server";

import { createServerClient } from "@supabase/ssr";
import { parseForm, signWaiverSchema } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export async function signWaiver(token: string, formData: FormData) {
  const supabase = publicClient();
  if (!formData.get("agree")) {
    throw new Error("You must agree to the terms before signing.");
  }
  const v = parseForm(signWaiverSchema, formData);
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  const ua = h.get("user-agent") || null;

  // Find the pending signature row by token
  const { data: row } = await (supabase as any)
    .from("waiver_signatures")
    .select("id, organization_id, signature_image_url")
    .eq("token", token)
    .maybeSingle();
  if (!row) throw new Error("Signature link not found or expired.");

  // Upload the signature image to storage (signatures bucket if it exists, otherwise photos)
  let imageUrl: string | null = null;
  try {
    const dataUrl = v.signature_data;
    if (dataUrl.startsWith("data:image")) {
      const base64 = dataUrl.split(",")[1] ?? "";
      const bytes = Buffer.from(base64, "base64");
      const path = `${row.organization_id}/signatures/${token}.png`;
      const up = await supabase.storage.from("photos").upload(path, bytes, {
        contentType: "image/png",
        upsert: true,
      });
      if (!up.error) {
        const { data: signed } = await supabase.storage.from("photos").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        imageUrl = signed?.signedUrl ?? null;
      }
    }
  } catch {
    // best-effort; keep going
  }

  const { error } = await (supabase as any)
    .from("waiver_signatures")
    .update({
      signer_name: v.signer_name,
      signer_email: v.signer_email ?? null,
      signer_phone: v.signer_phone ?? null,
      signature_image_url: imageUrl,
      signed_text: v.signer_name,
      status: "signed",
      signed_at: new Date().toISOString(),
      ip,
      user_agent: ua,
    })
    .eq("token", token)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  revalidatePath(`/waiver/${token}`);
  redirect(`/waiver/${token}`);
}
