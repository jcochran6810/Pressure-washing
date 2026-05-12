"use server";

import { createServerClient } from "@supabase/ssr";
import { sendEmail } from "@/lib/email";
import { redirect } from "next/navigation";

function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export async function submitReview(token: string, formData: FormData) {
  const supabase = publicClient();
  const rating = Number(formData.get("rating") || 5);
  const comment = String(formData.get("comment") || "").trim() || null;

  await supabase
    .from("review_feedback")
    .update({ rating, comment, responded_at: new Date().toISOString() })
    .eq("token", token);

  // Read back the org + customer info to route internally on low ratings
  const { data: fb } = await supabase
    .from("review_feedback")
    .select("*, organizations(name, email, google_review_url), customers(first_name, last_name, email, phone)")
    .eq("token", token)
    .maybeSingle();

  if (fb && rating <= 3 && (fb.organizations as any)?.email) {
    const cust: any = fb.customers ?? {};
    const html = `<!doctype html><body style="font-family:system-ui,sans-serif;padding:24px;">
      <h2>Unhappy customer feedback</h2>
      <p><strong>${rating} stars</strong> from ${[cust.first_name, cust.last_name].filter(Boolean).join(" ") || cust.email || "Anonymous"}</p>
      <p>${comment || "(no comment)"}</p>
      <p>Contact: ${cust.email || ""} ${cust.phone || ""}</p>
    </body></html>`;
    await sendEmail({
      to: (fb.organizations as any).email,
      subject: `⚠️ ${rating}-star feedback received`,
      html,
    });
  }

  redirect(`/review/${token}`);
}
