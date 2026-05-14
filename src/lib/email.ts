// Resend-based email. Set RESEND_API_KEY and RESEND_FROM in .env.local.
// We use fetch instead of the SDK to keep dependencies minimal.

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  apiKey?: string;
  from?: string;
};

export type EmailResult = { ok: true; id: string } | { ok: false; reason: string };

export async function sendEmail(args: SendArgs): Promise<EmailResult> {
  const key = args.apiKey || process.env.RESEND_API_KEY;
  const from = args.from || process.env.RESEND_FROM || "Home Services <onboarding@resend.dev>";
  if (!key) {
    return { ok: false, reason: "Email not configured for this account" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      reply_to: args.replyTo ? [args.replyTo] : undefined,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, reason: text };
  }
  const data = await res.json();
  return { ok: true, id: (data?.id as string) ?? "" };
}

export function receiptHtml(opts: {
  orgName: string;
  orgEmail?: string | null;
  invoiceNumber: string;
  customerName: string;
  amount: string;
  paymentMethod: string;
  paymentDate: string;
  total: string;
  remainingBalance: string;
  fullyPaid: boolean;
}) {
  const stamp = opts.fullyPaid
    ? `<div style="display:inline-block;padding:8px 16px;border:3px solid #16a34a;color:#16a34a;font-weight:800;letter-spacing:2px;transform:rotate(-6deg);border-radius:6px;font-size:20px;margin:16px 0;">PAID</div>`
    : `<div style="display:inline-block;padding:8px 16px;border:3px solid #2563eb;color:#2563eb;font-weight:800;letter-spacing:2px;border-radius:6px;font-size:18px;margin:16px 0;">PAYMENT RECEIVED</div>`;

  return `
  <!doctype html>
  <html>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
      <h1 style="margin:0 0 4px;font-size:22px;">${opts.orgName}</h1>
      <p style="margin:0;color:#64748b;font-size:13px;">Payment receipt for invoice ${opts.invoiceNumber}</p>
      ${stamp}
      <p>Hi ${opts.customerName},</p>
      <p>Thank you — we've received your payment. Here are the details:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <tr><td style="padding:6px 0;color:#64748b;">Amount paid</td><td style="text-align:right;font-weight:600;">${opts.amount}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Payment method</td><td style="text-align:right;text-transform:capitalize;">${opts.paymentMethod}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Payment date</td><td style="text-align:right;">${opts.paymentDate}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Invoice total</td><td style="text-align:right;">${opts.total}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;border-top:1px solid #e2e8f0;">Remaining balance</td><td style="text-align:right;border-top:1px solid #e2e8f0;font-weight:600;">${opts.remainingBalance}</td></tr>
      </table>
      <p style="color:#64748b;font-size:13px;">Reply to this email if you have questions. Thanks for your business!</p>
      <p style="color:#64748b;font-size:12px;margin-top:24px;">${opts.orgName}${opts.orgEmail ? ` • ${opts.orgEmail}` : ""}</p>
    </div>
  </body>
  </html>`;
}
