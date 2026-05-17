import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/lifecycle-emails";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data: exchanged } = await supabase.auth.exchangeCodeForSession(code);

    // Send welcome email on first sign-in (non-blocking, idempotent via flag).
    const user = exchanged?.user;
    if (user && !(user as any).is_anonymous) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("default_organization_id, organizations:default_organization_id(id, name, email, welcome_email_sent_at)")
          .eq("id", user.id)
          .single();
        const org: any = (profile as any)?.organizations;
        if (org?.email && !org.welcome_email_sent_at) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
          const tpl = welcomeEmail({ orgName: org.name, appUrl });
          await sendEmail({ to: org.email, subject: tpl.subject, html: tpl.html });
          await supabase.from("organizations")
            .update({ welcome_email_sent_at: new Date().toISOString() })
            .eq("id", org.id);
        }
      } catch (e) {
        console.error("Welcome email failed:", e);
      }
    }
  }
  return NextResponse.redirect(`${origin}${next}`);
}
