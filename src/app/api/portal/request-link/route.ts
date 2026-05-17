import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { sendEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

function randomToken() {
  // 32 bytes = 256 bits of entropy, hex-encoded → 64 chars
  return randomBytes(32).toString("hex");
}

export async function POST(request: Request) {
  // Rate limit: 5 link-request attempts per IP per 15 minutes
  const ip = clientIp(request);
  const rl = rateLimit({ key: `portal-link:${ip}`, limit: 5, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const email = String(body?.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const supabase = adminClient();

  // Find customer by email — return success regardless of match (prevent enumeration)
  const { data: customers } = await supabase
    .from("customers")
    .select("id, organization_id, first_name, last_name, company_name, organizations(name, email)")
    .ilike("email", email)
    .limit(5);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  if (!customers?.length) {
    return NextResponse.json({ ok: true });
  }

  // Issue one token per matching customer (handles a customer with the same email across two orgs)
  const links: string[] = [];
  for (const customer of customers) {
    const token = randomToken();
    const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes
    await supabase.from("customer_portal_sessions").insert({
      organization_id: customer.organization_id,
      customer_id: customer.id,
      token,
      email,
      expires_at: expires.toISOString(),
      created_ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: request.headers.get("user-agent"),
    });
    links.push(`${appUrl}/portal/verify?token=${token}`);
  }

  const org: any = (customers[0] as any).organizations;
  const linksHtml = links.map((l) => `<a href="${l}" style="display:inline-block;margin:8px 0;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Open my portal</a>`).join("<br/>");
  const subject = `Sign in to your customer portal — ${org?.name ?? "Suds"}`;
  const html = `<!doctype html><body style="font-family:system-ui,sans-serif;padding:24px;background:#f8fafc;">
    <div style="max-width:480px;margin:0 auto;background:#fff;padding:24px;border-radius:12px;border:1px solid #e2e8f0;">
      <h2 style="margin:0 0 12px;">Welcome back</h2>
      <p>Click the button below to sign in to your customer portal. This link expires in 30 minutes.</p>
      ${linksHtml}
      <p style="color:#64748b;font-size:12px;margin-top:24px;">If you didn't request this, you can safely ignore it. ${org?.name ?? ""}</p>
    </div>
  </body></html>`;

  const result = await sendEmail({ to: email, subject, html, replyTo: org?.email ?? undefined });

  if (!result.ok) {
    // In dev / no Resend, surface the link in the response so the user can still test
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: true, dev_link: links[0] }, { status: 200 });
    }
  }
  return NextResponse.json({ ok: true });
}
