// Sending a paid-stamped receipt email + writing the receipt_log row are
// two things that need to happen together every time an invoice goes paid,
// no matter the trigger: in-app recordPayment, Stripe webhook, or the
// manual "Send receipt" button on the next-step banner. Factor it out so
// all three paths use the same code.

import { receiptHtml } from "@/lib/email";
import { sendOrgEmail } from "@/lib/org-messaging";
import { customerDisplayName, formatCurrency, formatDate } from "@/lib/utils";

type Sender = {
  from(t: string): any;
};

type Args = {
  supabase: Sender;
  organizationId: string;
  invoice: {
    id: string;
    invoice_number: string;
    total: number | null;
    customer_id: string;
    customers?: any;
  };
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  newBalance: number;
  paymentId?: string | null;
};

export async function sendInvoiceReceiptEmail(args: Args): Promise<{ ok: boolean; reason?: string }> {
  const cust = args.invoice.customers as any;
  if (!cust?.email) return { ok: false, reason: "Customer has no email" };

  // Idempotency: skip if we've already SUCCESSFULLY sent a receipt for this
  // exact payment. If the prior attempt failed, allow a retry. Manual "Send
  // receipt" (no paymentId) skips if any successful receipt exists.
  let existingQ: any = (args.supabase as any)
    .from("receipt_log")
    .select("id")
    .eq("invoice_id", args.invoice.id)
    .eq("status", "sent")
    .limit(1);
  if (args.paymentId) {
    existingQ = existingQ.eq("payment_id", args.paymentId);
  }
  const { data: existing } = await existingQ;
  if (existing && existing.length > 0) {
    return { ok: false, reason: "Receipt already sent" };
  }

  const { data: org } = await (args.supabase as any)
    .from("organizations")
    .select("name, email, currency")
    .eq("id", args.organizationId)
    .single();

  const fullyPaid = args.newBalance === 0;
  const html = receiptHtml({
    orgName: org?.name ?? "Your Business",
    orgEmail: org?.email ?? null,
    invoiceNumber: args.invoice.invoice_number,
    customerName: customerDisplayName(cust),
    amount: formatCurrency(args.amount, org?.currency ?? "USD"),
    paymentMethod: args.paymentMethod,
    paymentDate: formatDate(args.paymentDate),
    total: formatCurrency(Number(args.invoice.total ?? 0), org?.currency ?? "USD"),
    remainingBalance: formatCurrency(args.newBalance, org?.currency ?? "USD"),
    fullyPaid,
  });

  const result = await sendOrgEmail(args.organizationId, {
    to: cust.email,
    subject: `Receipt — Invoice ${args.invoice.invoice_number}`,
    html,
    replyTo: org?.email ?? undefined,
  });

  // Log every attempt (success OR failure) so the workflow banner clears
  // and the admin send log shows the outcome.
  await (args.supabase as any).from("receipt_log").insert({
    organization_id: args.organizationId,
    invoice_id: args.invoice.id,
    payment_id: args.paymentId ?? null,
    customer_id: args.invoice.customer_id,
    email_to: cust.email,
    provider: "resend",
    provider_id: result.ok ? result.id : null,
    status: result.ok ? "sent" : "failed",
  });

  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}
