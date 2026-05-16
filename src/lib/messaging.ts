// High-level send: pick an org-customised template (or default), render variables,
// and dispatch via email (Resend) or SMS (Telnyx). Records SMS in sms_log.
// Per-org credentials (BYOC) override the platform env vars when present.

import { sendEmail } from "@/lib/email";
import { sendSms, normalizePhone } from "@/lib/sms";
import { loadOrgMessagingCreds } from "@/lib/org-messaging";
import { canSend } from "@/lib/billing-server";
import {
  DEFAULT_TEMPLATES,
  pickTemplate,
  plainTextToEmailHtml,
  renderTemplate,
  type TemplateChannel,
  type TemplateKind,
  type TemplateVars,
} from "@/lib/message-templates";

type SupabaseLike = {
  from: (t: string) => any;
};

type SendArgs = {
  supabase: SupabaseLike;
  organizationId: string;
  customerId?: string | null;
  kind: TemplateKind;
  channel: TemplateChannel;
  to: { email?: string | null; phone?: string | null };
  vars: TemplateVars;
  relatedKind?: string;
  relatedId?: string;
  replyToEmail?: string | null;
  fromNumber?: string | null;
};

export type SendResult =
  | { ok: true; channel: TemplateChannel; id?: string; renderedSubject?: string | null; renderedBody: string }
  | { ok: false; reason: string };

export async function sendTemplated(args: SendArgs): Promise<SendResult> {
  const [{ data: rows }, creds, prefs] = await Promise.all([
    args.supabase
      .from("message_templates")
      .select("kind, channel, subject, body, is_default")
      .eq("organization_id", args.organizationId),
    loadOrgMessagingCreds(args.organizationId),
    args.customerId
      ? args.supabase
          .from("customer_messaging_prefs")
          .select("email_opt_out, sms_opt_out")
          .eq("customer_id", args.customerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Honor unsubscribe. Customer opt-outs apply to ALL sends including
  // transactional — operator should verify legal requirements per locale.
  const optOut = (prefs as any)?.data ?? null;
  if (args.channel === "email" && optOut?.email_opt_out) {
    return { ok: false, reason: "Recipient has unsubscribed from email" };
  }
  if (args.channel === "sms" && optOut?.sms_opt_out) {
    return { ok: false, reason: "Recipient has unsubscribed from SMS" };
  }

  // Fetch portal token to power one-click unsubscribe headers + footer link.
  let unsubscribeUrl: string | null = null;
  if (args.channel === "email" && args.customerId) {
    const { data: c } = await args.supabase
      .from("customers")
      .select("portal_token")
      .eq("id", args.customerId)
      .maybeSingle();
    if ((c as any)?.portal_token) {
      const origin = process.env.NEXT_PUBLIC_APP_URL || "";
      unsubscribeUrl = `${origin}/u/${(c as any).portal_token}?channel=email`;
    }
  }

  const tpl =
    pickTemplate(rows ?? [], args.kind, args.channel) ??
    DEFAULT_TEMPLATES.find((t) => t.kind === args.kind && t.channel === args.channel);

  if (!tpl) return { ok: false, reason: `No template for ${args.kind}/${args.channel}` };
  const subject = tpl.subject ? renderTemplate(tpl.subject, args.vars) : null;
  const body = renderTemplate(tpl.body, args.vars);

  if (args.channel === "email") {
    if (!args.to.email) return { ok: false, reason: "Customer has no email" };
    if (creds.mode !== "byoc") {
      const gate = await canSend(args.organizationId, "email");
      if (!gate.ok) return { ok: false, reason: gate.reason ?? "Email quota exceeded" };
    }
    const footer = unsubscribeUrl
      ? `<hr style="margin:32px 0 8px;border:none;border-top:1px solid #e2e8f0;"/><p style="color:#94a3b8;font-size:11px;">Don't want these emails? <a href="${unsubscribeUrl}" style="color:#94a3b8;">Unsubscribe</a></p>`
      : "";
    const result = await sendEmail({
      to: args.to.email,
      subject: subject || "Message",
      html: plainTextToEmailHtml(body) + footer,
      replyTo: args.replyToEmail ?? undefined,
      apiKey: creds.resendApiKey ?? undefined,
      from: creds.resendFrom ?? undefined,
      listUnsubscribeUrl: unsubscribeUrl,
    });
    if (creds.mode !== "byoc") {
      try {
        await args.supabase.from("email_log").insert({
          organization_id: args.organizationId,
          customer_id: args.customerId ?? null,
          to_email: args.to.email,
          subject,
          provider: "resend",
          provider_id: result.ok ? result.id : null,
          status: result.ok ? "sent" : "failed",
          error: result.ok ? null : result.reason,
          related_kind: args.relatedKind ?? null,
          related_id: args.relatedId ?? null,
        });
      } catch { /* best-effort */ }
    }
    return result.ok
      ? { ok: true, channel: "email", id: result.id, renderedSubject: subject, renderedBody: body }
      : { ok: false, reason: result.reason };
  }

  // SMS path
  const to = normalizePhone(args.to.phone);
  if (!to) return { ok: false, reason: "Customer has no valid phone number" };
  if (creds.mode !== "byoc") {
    const gate = await canSend(args.organizationId, "sms");
    if (!gate.ok) return { ok: false, reason: gate.reason ?? "SMS quota exceeded" };
  }
  const fromNumber = args.fromNumber ?? creds.telnyxFromNumber ?? undefined;
  const smsResult = await sendSms({
    to,
    body,
    from: fromNumber,
    apiKey: creds.telnyxApiKey ?? undefined,
  });
  // Log every attempt
  try {
    await args.supabase.from("sms_log").insert({
      organization_id: args.organizationId,
      customer_id: args.customerId ?? null,
      to_number: to,
      from_number: fromNumber ?? process.env.TELNYX_FROM_NUMBER ?? null,
      body,
      provider: "telnyx",
      provider_id: smsResult.ok ? smsResult.id : null,
      status: smsResult.ok ? "sent" : "failed",
      error: smsResult.ok ? null : smsResult.reason,
      related_kind: args.relatedKind ?? null,
      related_id: args.relatedId ?? null,
      sent_at: smsResult.ok ? new Date().toISOString() : null,
    });
  } catch {
    // Best-effort logging; do not block the send result
  }
  return smsResult.ok
    ? { ok: true, channel: "sms", id: smsResult.id, renderedBody: body }
    : { ok: false, reason: smsResult.reason };
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
