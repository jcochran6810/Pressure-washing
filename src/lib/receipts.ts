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

  // Fully paid → archive every line-item photo and job before/after photo
  // to the org's Google Drive. Best-effort, fails silently.
  if (fullyPaid) {
    try {
      const photos = await collectInvoicePhotos(args.supabase as any, args.invoice.id);
      if (photos.length > 0) {
        const { archiveInvoicePhotosToDrive } = await import("@/lib/drive-uploader");
        await archiveInvoicePhotosToDrive({
          organization_id: args.organizationId,
          invoice_number: args.invoice.invoice_number,
          photoUrls: photos,
        });
      }
    } catch (e) {
      console.error("archive on payment failed:", e);
    }
  }

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

// Collect every URL we should back up to Drive for a paid invoice:
//   * line-item photo_urls on the invoice's own line items
//   * line-item photo_urls on the source estimate's line items (if any)
//   * the linked job's before_photos / after_photos arrays
async function collectInvoicePhotos(supabase: any, invoice_id: string): Promise<string[]> {
  const out = new Set<string>();
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, estimate_id, job_id, invoice_line_items(photo_urls)")
    .eq("id", invoice_id)
    .maybeSingle();
  if (!inv) return [];
  for (const li of (inv.invoice_line_items as any[]) ?? []) {
    for (const u of (li.photo_urls as string[]) ?? []) if (u) out.add(u);
  }
  if (inv.estimate_id) {
    const { data: est } = await supabase
      .from("estimates")
      .select("estimate_line_items(photo_urls)")
      .eq("id", inv.estimate_id)
      .maybeSingle();
    for (const li of (est?.estimate_line_items as any[]) ?? []) {
      for (const u of (li.photo_urls as string[]) ?? []) if (u) out.add(u);
    }
  }
  if (inv.job_id) {
    const { data: job } = await supabase
      .from("jobs")
      .select("before_photos, after_photos")
      .eq("id", inv.job_id)
      .maybeSingle();
    for (const u of ((job?.before_photos as string[]) ?? [])) if (u) out.add(u);
    for (const u of ((job?.after_photos as string[]) ?? [])) if (u) out.add(u);
  }
  return Array.from(out);
}
