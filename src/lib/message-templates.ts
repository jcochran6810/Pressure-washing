// Message templates: pre-made email + SMS bodies for estimates, invoices,
// receipts, reminders, waivers, contracts. Supports {{handlebars}} variables.

export type TemplateKind =
  | "estimate_send"
  | "invoice_send"
  | "receipt"
  | "payment_reminder"
  | "appointment_reminder"
  | "review_request"
  | "contract_renewal"
  | "waiver_request";

export type TemplateChannel = "email" | "sms";

export type TemplateVars = Record<string, string | number | null | undefined>;

export type Template = {
  kind: TemplateKind;
  channel: TemplateChannel;
  name: string;
  subject?: string;
  body: string;
};

// Defaults shipped with the app; overridable in /settings/templates.
export const DEFAULT_TEMPLATES: Template[] = [
  {
    kind: "estimate_send",
    channel: "email",
    name: "Estimate ready (default email)",
    subject: "Your estimate from {{org_name}} — {{estimate_number}}",
    body:
      "Hi {{customer_first_name}},\n\n" +
      "Thanks for getting in touch. Your estimate for {{estimate_total}} is ready to review and approve online:\n\n" +
      "{{approval_url}}\n\n" +
      "This estimate is valid until {{expires_at}}. Reply to this email with any questions.\n\n" +
      "— {{org_name}}",
  },
  {
    kind: "estimate_send",
    channel: "sms",
    name: "Estimate ready (default SMS)",
    body: "{{org_name}}: Your estimate {{estimate_number}} for {{estimate_total}} is ready. Review & approve: {{approval_url}}",
  },
  {
    kind: "invoice_send",
    channel: "email",
    name: "Invoice sent (default email)",
    subject: "Invoice {{invoice_number}} — {{org_name}}",
    body:
      "Hi {{customer_first_name}},\n\n" +
      "Your invoice {{invoice_number}} for {{invoice_total}} is ready.\n" +
      "Balance due: {{balance_due}} by {{due_date}}.\n\n" +
      "Pay online: {{payment_link}}\n\n" +
      "Thanks for your business!\n— {{org_name}}",
  },
  {
    kind: "invoice_send",
    channel: "sms",
    name: "Invoice sent (default SMS)",
    body: "{{org_name}}: Invoice {{invoice_number}} for {{invoice_total}} is ready. Pay online: {{payment_link}}",
  },
  {
    kind: "receipt",
    channel: "email",
    name: "Payment receipt (default email)",
    subject: "Receipt — Invoice {{invoice_number}}",
    body:
      "Hi {{customer_first_name}},\n\n" +
      "Thanks — we received your payment of {{amount_paid}} on {{payment_date}} ({{payment_method}}).\n" +
      "Invoice {{invoice_number}} total: {{invoice_total}}.\n" +
      "Remaining balance: {{balance_due}}.\n\n" +
      "— {{org_name}}",
  },
  {
    kind: "receipt",
    channel: "sms",
    name: "Payment receipt (default SMS)",
    body: "{{org_name}}: Received {{amount_paid}} for invoice {{invoice_number}}. Remaining: {{balance_due}}. Thanks!",
  },
  {
    kind: "payment_reminder",
    channel: "email",
    name: "Payment reminder (default email)",
    subject: "Friendly reminder: Invoice {{invoice_number}}",
    body:
      "Hi {{customer_first_name}},\n\n" +
      "Just a quick reminder that invoice {{invoice_number}} for {{balance_due}} is due {{due_date}}.\n\n" +
      "Pay online here: {{payment_link}}\n\n" +
      "Thanks!\n— {{org_name}}",
  },
  {
    kind: "payment_reminder",
    channel: "sms",
    name: "Payment reminder (default SMS)",
    body: "{{org_name}}: Invoice {{invoice_number}} ({{balance_due}}) is due {{due_date}}. Pay: {{payment_link}}",
  },
  {
    kind: "appointment_reminder",
    channel: "email",
    name: "Appointment reminder (default email)",
    subject: "Reminder: your appointment is coming up",
    body:
      "Hi {{customer_first_name}},\n\n" +
      "This is a reminder that your appointment with {{org_name}} is scheduled for {{scheduled_start}} at {{property_address}}.\n\n" +
      "Reply or call {{org_phone}} if you need to reschedule.\n\n" +
      "— {{org_name}}",
  },
  {
    kind: "appointment_reminder",
    channel: "sms",
    name: "Appointment reminder (default SMS)",
    body: "{{org_name}}: Your appointment is {{scheduled_start}} at {{property_address}}. Reply STOP to opt out.",
  },
  {
    kind: "review_request",
    channel: "email",
    name: "Review request (default email)",
    subject: "How did we do?",
    body:
      "Hi {{customer_first_name}},\n\n" +
      "Thanks for choosing {{org_name}}! Mind taking 20 seconds to rate your experience? It helps us a ton.\n\n" +
      "{{review_url}}\n\n" +
      "— {{org_name}}",
  },
  {
    kind: "review_request",
    channel: "sms",
    name: "Review request (default SMS)",
    body: "Thanks for choosing {{org_name}}! How did we do? {{review_url}}",
  },
  {
    kind: "contract_renewal",
    channel: "email",
    name: "Recurring service due (default email)",
    subject: "Time to book your next {{contract_name}}",
    body:
      "Hi {{customer_first_name}},\n\n" +
      "It's been a while — your next {{contract_name}} is scheduled for {{next_run_date}}. We've drafted an estimate for {{estimate_total}}:\n\n" +
      "{{approval_url}}\n\n" +
      "Reply to confirm or pick a new date.\n\n— {{org_name}}",
  },
  {
    kind: "contract_renewal",
    channel: "sms",
    name: "Recurring service due (default SMS)",
    body: "{{org_name}}: Time to book your {{contract_name}}. Estimate {{estimate_total}} ready: {{approval_url}}",
  },
  {
    kind: "waiver_request",
    channel: "email",
    name: "Sign waiver (default email)",
    subject: "Please sign the service waiver — {{org_name}}",
    body:
      "Hi {{customer_first_name}},\n\n" +
      "Before we begin, please review and sign our service waiver:\n\n" +
      "{{waiver_url}}\n\n" +
      "Takes 30 seconds. Thanks!\n— {{org_name}}",
  },
  {
    kind: "waiver_request",
    channel: "sms",
    name: "Sign waiver (default SMS)",
    body: "{{org_name}}: Please sign our service waiver before we begin: {{waiver_url}}",
  },
];

export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = vars[key as keyof TemplateVars];
    return v === null || v === undefined ? "" : String(v);
  });
}

export function pickTemplate(
  templates: Array<{ kind: string; channel: string; subject: string | null; body: string; is_default: boolean | null }>,
  kind: TemplateKind,
  channel: TemplateChannel,
): { subject: string | null; body: string } | null {
  const matches = templates.filter((t) => t.kind === kind && t.channel === channel);
  if (!matches.length) {
    const fallback = DEFAULT_TEMPLATES.find((t) => t.kind === kind && t.channel === channel);
    return fallback ? { subject: fallback.subject ?? null, body: fallback.body } : null;
  }
  const def = matches.find((m) => m.is_default) ?? matches[0];
  return { subject: def.subject, body: def.body };
}

export function plainTextToEmailHtml(text: string): string {
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const linked = safe.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2563eb">$1</a>');
  return `<!doctype html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0;white-space:pre-wrap;font-size:14px;color:#111827;">
${linked}
    </div>
  </body>`;
}
