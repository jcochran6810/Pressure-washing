// High-level send: pick an org-customised template (or default), render variables,
// and dispatch via email (Resend) or SMS (Telnyx). Records SMS in sms_log.

import { sendEmail } from "@/lib/email";
import { sendSms, normalizePhone } from "@/lib/sms";
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
  const { data: rows } = await args.supabase
    .from("message_templates")
    .select("kind, channel, subject, body, is_default")
    .eq("organization_id", args.organizationId);

  const tpl =
    pickTemplate(rows ?? [], args.kind, args.channel) ??
    DEFAULT_TEMPLATES.find((t) => t.kind === args.kind && t.channel === args.channel);

  if (!tpl) return { ok: false, reason: `No template for ${args.kind}/${args.channel}` };
  const subject = tpl.subject ? renderTemplate(tpl.subject, args.vars) : null;
  const body = renderTemplate(tpl.body, args.vars);

  if (args.channel === "email") {
    if (!args.to.email) return { ok: false, reason: "Customer has no email" };
    const result = await sendEmail({
      to: args.to.email,
      subject: subject || "Message",
      html: plainTextToEmailHtml(body),
      replyTo: args.replyToEmail ?? undefined,
    });
    return result.ok
      ? { ok: true, channel: "email", id: result.id, renderedSubject: subject, renderedBody: body }
      : { ok: false, reason: result.reason };
  }

  // SMS path
  const to = normalizePhone(args.to.phone);
  if (!to) return { ok: false, reason: "Customer has no valid phone number" };
  const smsResult = await sendSms({ to, body, from: args.fromNumber ?? undefined });
  // Log every attempt
  try {
    await args.supabase.from("sms_log").insert({
      organization_id: args.organizationId,
      customer_id: args.customerId ?? null,
      to_number: to,
      from_number: args.fromNumber ?? process.env.TELNYX_FROM_NUMBER ?? null,
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
