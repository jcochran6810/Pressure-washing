"use server";

import { getSessionAndOrg } from "@/lib/org";
import { receiptHtml } from "@/lib/email";
import { sendOrgEmail } from "@/lib/org-messaging";
import { uploadHtmlToDrive } from "@/lib/drive-uploader";
import { customerDisplayName, formatCurrency, formatDate } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export type BulkResult = { ok: number; failed: number; errors: string[] };

type ReceiptContext = {
  payment: any;
  invoice: any;
  customer: any;
  organization: any;
  html: string;
  subject: string;
  filename: string;
};

async function loadReceiptContext(paymentId: string): Promise<ReceiptContext> {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { data: payment } = await supabase
    .from("payments")
    .select("*, customers(*), invoices(id, invoice_number, total, balance_due, status)")
    .eq("id", paymentId)
    .eq("organization_id", organizationId)
    .single();
  if (!payment) throw new Error("Payment not found");

  const invoice = payment.invoices;
  if (!invoice) throw new Error("Receipt has no linked invoice");

  const customer = payment.customers;
  const currency = organization?.currency ?? "USD";
  const fullyPaid = invoice.status === "paid" || Number(invoice.balance_due ?? 0) === 0;

  const html = receiptHtml({
    orgName: organization?.name ?? "Your Business",
    orgEmail: organization?.email ?? null,
    invoiceNumber: invoice.invoice_number,
    customerName: customerDisplayName(customer ?? {}),
    amount: formatCurrency(Number(payment.amount ?? 0), currency),
    paymentMethod: payment.payment_method ?? "other",
    paymentDate: formatDate(payment.payment_date),
    total: formatCurrency(Number(invoice.total ?? 0), currency),
    remainingBalance: formatCurrency(Number(invoice.balance_due ?? 0), currency),
    fullyPaid,
  });

  const subject = `Receipt — Invoice ${invoice.invoice_number}`;
  const filename = `receipt-${invoice.invoice_number}-${payment.payment_date ?? new Date().toISOString().slice(0, 10)}.html`;

  return { payment, invoice, customer, organization, html, subject, filename };
}

async function recomputeInvoiceTotals(invoiceId: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: inv } = await supabase
    .from("invoices")
    .select("id, total, status")
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .single();
  if (!inv) return;
  const { data: remaining } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoiceId)
    .eq("organization_id", organizationId);
  const amount_paid = (remaining ?? []).reduce((s, p: any) => s + Number(p.amount ?? 0), 0);
  const total = Number(inv.total ?? 0);
  const balance_due = Math.max(0, total - amount_paid);
  let status = inv.status;
  if (amount_paid === 0) status = inv.status === "void" ? "void" : "sent";
  else if (balance_due === 0) status = "paid";
  else status = "partial";
  const patch: any = { amount_paid, balance_due, status };
  if (status !== "paid") patch.paid_at = null;
  await supabase.from("invoices").update(patch).eq("id", invoiceId).eq("organization_id", organizationId);
}

export async function bulkDeleteReceipts(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: 0, errors: [] };
  if (!ids.length) return result;
  const { supabase, organizationId } = await getSessionAndOrg();

  const { data: rows } = await supabase
    .from("payments")
    .select("id, invoice_id")
    .in("id", ids)
    .eq("organization_id", organizationId);

  const invoiceIds = Array.from(new Set((rows ?? []).map((r: any) => r.invoice_id).filter(Boolean)));

  const { error, count } = await supabase
    .from("payments")
    .delete({ count: "exact" })
    .in("id", ids)
    .eq("organization_id", organizationId);
  if (error) {
    result.failed = ids.length;
    result.errors.push(error.message);
    return result;
  }
  result.ok = count ?? ids.length;
  result.failed = ids.length - result.ok;

  for (const invId of invoiceIds) {
    try {
      await recomputeInvoiceTotals(invId);
      revalidatePath(`/invoices/${invId}`);
    } catch (e) {
      result.errors.push(`Recompute invoice ${invId}: ${(e as Error).message}`);
    }
  }
  revalidatePath("/payments");
  revalidatePath("/invoices");
  return result;
}

export async function bulkSaveReceiptsToDrive(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: 0, errors: [] };
  const { organizationId } = await getSessionAndOrg();
  for (const id of ids) {
    try {
      const ctx = await loadReceiptContext(id);
      await uploadHtmlToDrive({
        organization_id: organizationId,
        folder: "receipts_folder_id",
        name: ctx.filename,
        html: ctx.html,
      });
      result.ok++;
    } catch (e) {
      result.failed++;
      result.errors.push(`${id}: ${(e as Error).message}`);
    }
  }
  revalidatePath("/payments");
  return result;
}

export async function bulkEmailReceiptsToCustomers(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: 0, errors: [] };
  const { supabase, organizationId } = await getSessionAndOrg();
  for (const id of ids) {
    try {
      const ctx = await loadReceiptContext(id);
      const email = ctx.customer?.email;
      if (!email) throw new Error("Customer has no email");
      const sent = await sendOrgEmail(organizationId, {
        to: email,
        subject: ctx.subject,
        html: ctx.html,
        replyTo: ctx.organization?.email ?? undefined,
      });
      if (!sent.ok) throw new Error(sent.reason);
      await supabase.from("receipt_log").insert({
        organization_id: organizationId,
        invoice_id: ctx.invoice.id,
        payment_id: ctx.payment.id,
        customer_id: ctx.customer?.id ?? null,
        email_to: email,
        provider: "resend",
        provider_id: sent.id ?? null,
        status: "sent",
      });
      result.ok++;
    } catch (e) {
      result.failed++;
      result.errors.push(`${id}: ${(e as Error).message}`);
    }
  }
  revalidatePath("/payments");
  return result;
}
