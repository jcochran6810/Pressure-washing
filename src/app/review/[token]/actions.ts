"use server";

import { createServerClient } from "@supabase/ssr";
import { sendEmail } from "@/lib/email";
import { redirect } from "next/navigation";

// Token is passed via header so the RLS policy can verify the caller has
// authorization to update this specific review row.
function publicClient(token: string) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll() { return []; }, setAll() {} },
      global: { headers: { "x-review-token": token } },
    },
  );
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export async function submitReview(token: string, formData: FormData) {
  if (!token || token.length < 16) redirect("/");
  const supabase = publicClient(token);
  const rating = Math.min(5, Math.max(1, Number(formData.get("rating") || 5)));
  const comments = String(formData.get("comment") || "").trim().slice(0, 2000) || null;

  await supabase
    .from("review_feedback")
    .update({ rating, comments, submitted_at: new Date().toISOString() })
    .eq("token", token);

  // For low ratings, send an internal alert to the business owner so they can follow up
  if (rating <= 3) {
    const { data: fb } = await supabase
      .from("review_feedback")
      .select("organizations(name, email), customers(first_name, last_name, email, phone)")
      .eq("token", token)
      .maybeSingle();
    const org: any = fb?.organizations;
    const cust: any = fb?.customers ?? {};
    if (org?.email) {
      const customerLine = [cust.first_name, cust.last_name].filter(Boolean).join(" ") || cust.email || "Anonymous";
      const html = `<!doctype html><body style="font-family:system-ui,sans-serif;padding:24px;">
        <h2>Unhappy customer feedback</h2>
        <p><strong>${rating} stars</strong> from ${escapeHtml(customerLine)}</p>
        <p>${escapeHtml(comments || "(no comment)")}</p>
        <p>Contact: ${escapeHtml(cust.email || "")} ${escapeHtml(cust.phone || "")}</p>
      </body></html>`;
      await sendEmail({
        to: org.email,
        subject: `Feedback received — ${rating} stars`,
        html,
      });
    }
  }

  redirect(`/review/${token}`);
}
