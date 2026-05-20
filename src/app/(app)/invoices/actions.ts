"use server";

import { getSessionAndOrg } from "@/lib/org";
import { getStripe } from "@/lib/stripe";
import { sendOrgEmail } from "@/lib/org-messaging";
import { uploadHtmlToDrive } from "@/lib/drive-uploader";
import { invoiceHtml } from "@/lib/document-html";
import { invoicePdf } from "@/lib/document-pdf";
import { invoiceSchema, paymentSchema, parseForm } from "@/lib/validation";
import { formatCurrency, formatDate, customerDisplayName } from "@/lib/utils";
import { sendInvoiceReceiptEmail } from "@/lib/receipts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  photos: string[];
  materials_description: string | null;
  materials_cost: number;
};

function lineTotal(i: LineItem): number {
  return i.quantity * i.unit_price + (i.materials_cost ?? 0);
}

function parseLineItems(formData: FormData): LineItem[] {
  const descs = formData.getAll("li_description") as string[];
  const qtys = formData.getAll("li_quantity") as string[];
  const prices = formData.getAll("li_unit_price") as string[];
  const photoStrs = formData.getAll("li_photos") as string[];
  const matDescs = formData.getAll("li_materials_description") as string[];
  const matCosts = formData.getAll("li_materials_cost") as string[];
  const out: LineItem[] = [];
  for (let i = 0; i < descs.length; i++) {
    const d = (descs[i] || "").trim();
    if (!d) continue;
    let urls: string[] = [];
    try {
      const parsed = JSON.parse(photoStrs[i] || "[]");
      if (Array.isArray(parsed)) urls = parsed.filter((u) => typeof u === "string");
    } catch {}
    out.push({
      description: d,
      quantity: Number(qtys[i] || 1),
      unit_price: Number(prices[i] || 0),
      photos: urls,
      materials_description: (matDescs[i] || "").trim() || null,
      materials_cost: Number(matCosts[i] || 0) || 0,
    });
  }
  return out;
}

async function nextInvoiceNumber(orgId: string, supabase: any) {
  const { nextDocumentNumber } = await import("@/lib/numbering");
  return nextDocumentNumber(supabase, orgId);
}

export async function createInvoice(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const validated = parseForm(invoiceSchema, formData);
  const customer_id = validated.customer_id;
  const due_date = validated.due_date || null;
  const issue_date = validated.issue_date || new Date().toISOString().slice(0, 10);
  const tax_rate = validated.tax_rate ?? 0;
  const discount_amount = validated.discount_amount ?? 0;
  const items = parseLineItems(formData);
  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
  const tax_amount = Math.max(0, subtotal - discount_amount) * tax_rate;
  const total = Math.max(0, subtotal - discount_amount) + tax_amount;
  const notes = validated.notes ?? null;
  const terms = validated.terms ?? null;

  const invoice_number = await nextInvoiceNumber(organizationId, supabase);

  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({ organization_id: organizationId, customer_id, invoice_number, issue_date, due_date, tax_rate, discount_amount, tax_amount, subtotal, total, balance_due: total, notes, terms, status: "draft" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (items.length) {
    await supabase.from("invoice_line_items").insert(
      items.map((i, idx) => ({
        invoice_id: inv.id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: lineTotal(i),
        sort_order: idx,
        photo_urls: i.photos,
        materials_description: i.materials_description,
        materials_cost: i.materials_cost ?? 0,
      } as any)),
    );
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${inv.id}`);
}

export async function updateInvoice(id: string, formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const validated = parseForm(invoiceSchema, formData);

  const { data: existing } = await supabase
    .from("invoices")
    .select("status, amount_paid")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!existing) throw new Error("Invoice not found");
  if (existing.status === "paid" || existing.status === "void") {
    throw new Error("This invoice is locked because it has been paid or voided.");
  }

  const due_date = validated.due_date || null;
  const issue_date = validated.issue_date || new Date().toISOString().slice(0, 10);
  const tax_rate = validated.tax_rate ?? 0;
  const discount_amount = validated.discount_amount ?? 0;
  const items = parseLineItems(formData);
  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
  const tax_amount = Math.max(0, subtotal - discount_amount) * tax_rate;
  const total = Math.max(0, subtotal - discount_amount) + tax_amount;
  const amount_paid = Number(existing.amount_paid ?? 0);
  const balance_due = Math.max(0, total - amount_paid);

  await supabase
    .from("invoices")
    .update({
      customer_id: validated.customer_id,
      issue_date,
      due_date,
      tax_rate,
      discount_amount,
      tax_amount,
      subtotal,
      total,
      balance_due,
      notes: validated.notes ?? null,
      terms: validated.terms ?? null,
    })
    .eq("id", id)
    .eq("organization_id", organizationId);

  await supabase.from("invoice_line_items").delete().eq("invoice_id", id);
  if (items.length) {
    await supabase.from("invoice_line_items").insert(
      items.map((i, idx) => ({
        invoice_id: id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: lineTotal(i),
        sort_order: idx,
        photo_urls: i.photos,
        materials_description: i.materials_description,
        materials_cost: i.materials_cost ?? 0,
      } as any)),
    );
  }

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${id}`);
}

export async function setInvoiceStatus(id: string, status: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const patch: any = { status };
  if (status === "sent") patch.sent_at = new Date().toISOString();
  if (status === "paid") patch.paid_at = new Date().toISOString();
  await supabase.from("invoices").update(patch).eq("id", id).eq("organization_id", organizationId);
  revalidatePath(`/invoices/${id}`);
}

export async function recordPayment(invoiceId: string, formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const v = parseForm(paymentSchema, formData);
  const amount = v.amount;
  const payment_method = v.payment_method || "cash";
  const payment_date = v.payment_date || new Date().toISOString().slice(0, 10);
  const reference_number = v.reference_number ?? null;
  const notes = v.notes ?? null;

  const { data: inv } = await supabase
    .from("invoices")
    .select("customer_id, total, amount_paid, invoice_number, customers(first_name, last_name, company_name, email)")
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .single();
  if (!inv) throw new Error("Invoice not found");

  const { data: payment } = await supabase
    .from("payments")
    .insert({ organization_id: organizationId, invoice_id: invoiceId, customer_id: inv.customer_id, amount, payment_method: payment_method as any, payment_date, reference_number, notes })
    .select("id")
    .single();

  const new_paid = Number(inv.amount_paid ?? 0) + amount;
  const balance = Math.max(0, Number(inv.total ?? 0) - new_paid);
  const status = balance === 0 ? "paid" : "partial";
  const patch: any = { amount_paid: new_paid, balance_due: balance, status };
  if (status === "paid") patch.paid_at = new Date().toISOString();
  await supabase.from("invoices").update(patch).eq("id", invoiceId);

  // Send receipt (shared helper — also called by Stripe webhook + manual
  // "Send receipt" button so the receipt_log + email are consistent across
  // all three trigger paths).
  const sendReceipt = String(formData.get("send_receipt") || "on") === "on";
  if (sendReceipt) {
    await sendInvoiceReceiptEmail({
      supabase,
      organizationId,
      invoice: inv as any,
      amount,
      paymentMethod: payment_method,
      paymentDate: payment_date,
      newBalance: balance,
      paymentId: payment?.id ?? null,
    });
  }

  const cust: any = inv.customers;

  // If fully paid, queue a review request (sent immediately via Resend, with rating link)
  if (status === "paid") {
    const { data: org } = await supabase.from("organizations").select("name, email, google_review_url, review_request_enabled").eq("id", organizationId).single();
    if (org?.review_request_enabled && cust?.email) {
      const token = crypto.randomUUID().replace(/-/g, "");
      await supabase.from("review_feedback").insert({
        organization_id: organizationId,
        customer_id: inv.customer_id,
        invoice_id: invoiceId,
        token,
      });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const reviewUrl = `${appUrl}/review/${token}`;
      const subject = `How did we do? — ${org.name}`;
      const html = `<!doctype html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:24px;background:#f8fafc;">
        <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;">
          <h2 style="margin:0 0 12px;">Thanks for choosing ${org.name}!</h2>
          <p>Mind sharing how we did? It helps us improve and helps other neighbors find us.</p>
          <p style="text-align:center;margin:24px 0;">
            <a href="${reviewUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Rate your experience</a>
          </p>
          <p style="color:#64748b;font-size:12px;">If you'd rather just reply with feedback, we read every message.</p>
        </div>
      </body></html>`;
      await sendOrgEmail(organizationId, { to: cust.email, subject, html, replyTo: org.email ?? undefined });
    }

    // Schedule a recurring service reminder
    const { data: org2 } = await supabase.from("organizations").select("recurring_reminder_months").eq("id", organizationId).single();
    const months = org2?.recurring_reminder_months ?? 12;
    if (months > 0) {
      const remindAt = new Date();
      remindAt.setMonth(remindAt.getMonth() + months);
      await supabase.from("customer_reminders").insert({
        organization_id: organizationId,
        customer_id: inv.customer_id,
        kind: "recurring_service",
        channel: "email",
        scheduled_for: remindAt.toISOString(),
        message: `It's been ${months} months since your last service — ready to book again?`,
      });
    }
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/payments");
}

export async function createStripePaymentLink(invoiceId: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured. Set STRIPE_SECRET_KEY in .env.local.");

  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { data: inv } = await supabase
    .from("invoices")
    .select("*, invoice_line_items(*)")
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .single();
  if (!inv) throw new Error("Invoice not found");

  const connectedAccount = (organization as any)?.stripe_account_id || null;
  if (!connectedAccount) {
    throw new Error(
      "Connect your Stripe account in Settings → Stripe payments before creating a payment link. " +
      "Payments will deposit directly into your Stripe account.",
    );
  }
  const reqOpts = { stripeAccount: connectedAccount } as const;
  const currency = (organization?.currency || "USD").toLowerCase();

  // Pre-create products and prices on the connected account so the payment
  // link lives on their Stripe account and funds settle to them directly.
  const priceIds: { price: string; quantity: number }[] = [];
  let invoiceCents = 0;
  for (const li of inv.invoice_line_items as any[]) {
    const unitAmount = Math.round(Number(li.unit_price || 0) * 100);
    const qty = Math.max(1, Math.round(Number(li.quantity || 1)));
    invoiceCents += unitAmount * qty;
    const product = await stripe.products.create({ name: li.description }, reqOpts);
    const price = await stripe.prices.create(
      { product: product.id, currency, unit_amount: unitAmount },
      reqOpts,
    );
    priceIds.push({ price: price.id, quantity: qty });
  }

  const { platformFeeAmount } = await import("@/lib/stripe-connect");
  const feeCents = platformFeeAmount(invoiceCents);

  const link = await stripe.paymentLinks.create(
    {
      line_items: priceIds,
      metadata: {
        invoice_id: inv.id,
        organization_id: organizationId,
        invoice_number: inv.invoice_number,
      },
      ...(feeCents > 0
        ? { application_fee_amount: feeCents }
        : {}),
    } as any,
    reqOpts,
  );

  await supabase.from("invoices").update({ stripe_payment_link: link.url }).eq("id", inv.id);
  revalidatePath(`/invoices/${inv.id}`);
}

async function loadInvoiceForDoc(id: string) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { data: inv } = await supabase
    .from("invoices")
    .select("*, customers(*), invoice_line_items(*)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!inv) throw new Error("Invoice not found");
  return { supabase, organizationId, organization, inv };
}

export async function saveInvoiceToDrive(id: string) {
  const { organizationId, organization, inv } = await loadInvoiceForDoc(id);
  const items = (inv.invoice_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const html = invoiceHtml({
    org: organization,
    customer: inv.customers as any,
    invoiceNumber: inv.invoice_number,
    issueDate: inv.issue_date,
    dueDate: inv.due_date,
    items: items.map((li) => ({
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      total: Number(li.total),
      photo_urls: li.photo_urls ?? [],
      materials_description: li.materials_description ?? null,
      materials_cost: Number(li.materials_cost ?? 0),
    })),
    subtotal: Number(inv.subtotal), discount: Number(inv.discount_amount), taxRate: Number(inv.tax_rate),
    tax: Number(inv.tax_amount), total: Number(inv.total),
    amountPaid: Number(inv.amount_paid), balanceDue: Number(inv.balance_due),
    notes: inv.notes, terms: inv.terms, paid: inv.status === "paid",
    currency: organization?.currency,
  });
  await uploadHtmlToDrive({
    organization_id: organizationId,
    folder: "invoices_folder_id",
    name: `${inv.invoice_number}.html`,
    html,
  });
  revalidatePath(`/invoices/${id}`);
}

export async function emailInvoiceToCustomer(id: string) {
  // If this invoice is already paid, route to sendInvoiceReceipt instead —
  // the "send invoice" CTA on a paid invoice should never re-bill them.
  const { supabase, organizationId, organization, inv } = await loadInvoiceForDoc(id);
  if (inv.status === "paid") {
    await sendInvoiceReceipt(id);
    return;
  }

  // Auto-create the Stripe payment link first if Stripe is configured and we don't have one yet.
  if (!inv.stripe_payment_link && getStripe()) {
    try {
      await createStripePaymentLink(id);
    } catch (e) {
      // If Stripe fails, still send the invoice without the link.
      console.error("Stripe link generation failed:", e);
    }
  }

  // Reload after potentially creating the payment link.
  const { inv: fresh } = await loadInvoiceForDoc(id);
  const cust: any = fresh.customers;
  if (!cust?.email) throw new Error("Customer has no email.");

  const items = (fresh.invoice_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const docHtml = invoiceHtml({
    org: organization,
    customer: cust,
    invoiceNumber: fresh.invoice_number,
    issueDate: fresh.issue_date,
    dueDate: fresh.due_date,
    items: items.map((li) => ({
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      total: Number(li.total),
      photo_urls: li.photo_urls ?? [],
      materials_description: li.materials_description ?? null,
      materials_cost: Number(li.materials_cost ?? 0),
    })),
    subtotal: Number(fresh.subtotal), discount: Number(fresh.discount_amount), taxRate: Number(fresh.tax_rate),
    tax: Number(fresh.tax_amount), total: Number(fresh.total),
    amountPaid: Number(fresh.amount_paid), balanceDue: Number(fresh.balance_due),
    notes: fresh.notes, terms: fresh.terms, paid: false,
    currency: organization?.currency,
  });

  // Prepend a "Pay now" call-to-action when we have a Stripe link (only on
  // unpaid invoices — paid invoices took the early return above).
  const html = fresh.stripe_payment_link
    ? `<!doctype html><body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;">
        <div style="max-width:560px;margin:0 auto 16px;text-align:center;">
          <a href="${fresh.stripe_payment_link}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;">Pay invoice online →</a>
          <p style="font-size:12px;color:#64748b;margin-top:8px;">Secure payment via Stripe</p>
        </div>
      </body></html>${docHtml}`
    : docHtml;

  const subject = `Invoice ${fresh.invoice_number} from ${organization?.name}`;
  const pdfBytes = await invoicePdf({
    org: organization as any,
    customer: cust,
    invoiceNumber: fresh.invoice_number,
    issueDate: fresh.issue_date,
    dueDate: fresh.due_date,
    items: items.map((li) => ({
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      total: Number(li.total),
      materials_description: li.materials_description ?? null,
      materials_cost: Number(li.materials_cost ?? 0),
    })),
    subtotal: Number(fresh.subtotal),
    discount: Number(fresh.discount_amount ?? 0),
    taxRate: Number(fresh.tax_rate ?? 0),
    tax: Number(fresh.tax_amount ?? 0),
    total: Number(fresh.total),
    amountPaid: Number(fresh.amount_paid ?? 0),
    balanceDue: Number(fresh.balance_due ?? 0),
    notes: fresh.notes,
    terms: fresh.terms,
    paid: false,
    currency: (organization as any)?.currency,
  });
  await sendOrgEmail(organizationId, {
    to: cust.email,
    subject,
    html,
    replyTo: organization?.email ?? undefined,
    attachments: [
      { filename: `${fresh.invoice_number}.pdf`, content: pdfBytes, contentType: "application/pdf" },
    ],
  });
  await setInvoiceStatus(id, fresh.status === "draft" ? "sent" : fresh.status);
}

// Send (or re-send) the paid-receipt email for an invoice. Looks up the most
// recent payment for the receipt details. Writes to receipt_log so the
// workflow banner clears. Wired to the "Send receipt" button on the
// next-step banner and called by the Stripe webhook after a checkout
// completes.
export async function sendInvoiceReceipt(id: string) {
  const { supabase, organizationId, inv } = await loadInvoiceForDoc(id);
  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount, payment_method, payment_date")
    .eq("invoice_id", id)
    .order("payment_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const amount = Number(payment?.amount ?? inv.amount_paid ?? 0);
  const method = (payment as any)?.payment_method ?? "stripe";
  const paymentDate = (payment as any)?.payment_date ?? new Date().toISOString().slice(0, 10);
  await sendInvoiceReceiptEmail({
    supabase,
    organizationId,
    invoice: inv as any,
    amount,
    paymentMethod: method,
    paymentDate,
    newBalance: Number(inv.balance_due ?? 0),
    paymentId: payment?.id ?? null,
  });
  revalidatePath(`/invoices/${id}`);
}

export async function deleteInvoice(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("invoices").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/invoices");
  redirect("/invoices");
}

export type BulkResult = { ok: number; failed: number; errors: string[] };

export async function bulkDeleteInvoices(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: 0, errors: [] };
  if (!ids.length) return result;
  const { supabase, organizationId } = await getSessionAndOrg();
  const { error, count } = await supabase
    .from("invoices")
    .delete({ count: "exact" })
    .in("id", ids)
    .eq("organization_id", organizationId);
  if (error) {
    result.failed = ids.length;
    result.errors.push(error.message);
  } else {
    result.ok = count ?? ids.length;
    result.failed = ids.length - result.ok;
  }
  revalidatePath("/invoices");
  return result;
}

export async function bulkSaveInvoicesToDrive(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: 0, errors: [] };
  for (const id of ids) {
    try {
      await saveInvoiceToDrive(id);
      result.ok++;
    } catch (e) {
      result.failed++;
      result.errors.push(`${id}: ${(e as Error).message}`);
    }
  }
  revalidatePath("/invoices");
  return result;
}

export async function bulkEmailInvoicesToCustomers(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: 0, errors: [] };
  for (const id of ids) {
    try {
      await emailInvoiceToCustomer(id);
      result.ok++;
    } catch (e) {
      result.failed++;
      result.errors.push(`${id}: ${(e as Error).message}`);
    }
  }
  revalidatePath("/invoices");
  return result;
}

// Send invoice / receipt / reminder via templated email or SMS.
export async function sendInvoiceViaTemplate(
  id: string,
  channel: "email" | "sms",
  kind: "invoice_send" | "receipt" | "payment_reminder" = "invoice_send",
) {
  const { sendTemplated } = await import("@/lib/messaging");
  const { organizationId, organization, inv } = await loadInvoiceForDoc(id);
  const { supabase } = await getSessionAndOrg();
  const cust: any = inv.customers;

  // Ensure we have a Stripe link for invoice_send when configured
  if (kind !== "receipt" && !inv.stripe_payment_link && getStripe()) {
    try {
      await createStripePaymentLink(id);
    } catch (e) {
      console.error("Stripe link generation failed:", e);
    }
  }
  const { inv: invFresh } = await loadInvoiceForDoc(id);

  const result = await sendTemplated({
    supabase: supabase as any,
    organizationId,
    customerId: cust?.id ?? null,
    kind,
    channel,
    to: { email: cust?.email, phone: cust?.phone || cust?.mobile_phone },
    replyToEmail: organization?.email,
    relatedKind: "invoice",
    relatedId: id,
    vars: {
      org_name: organization?.name ?? "",
      org_phone: organization?.phone ?? "",
      customer_first_name: cust?.first_name ?? cust?.company_name ?? "there",
      invoice_number: invFresh.invoice_number,
      invoice_total: formatCurrency(Number(invFresh.total ?? 0), organization?.currency ?? "USD"),
      balance_due: formatCurrency(Number(invFresh.balance_due ?? 0), organization?.currency ?? "USD"),
      amount_paid: formatCurrency(Number(invFresh.amount_paid ?? 0), organization?.currency ?? "USD"),
      due_date: invFresh.due_date ? formatDate(invFresh.due_date) : "",
      payment_link: invFresh.stripe_payment_link ?? "",
      payment_method: "",
      payment_date: formatDate(new Date()),
    },
  });
  if (!result.ok) throw new Error(result.reason);
  if (kind === "invoice_send" && invFresh.status === "draft") {
    await setInvoiceStatus(id, "sent");
  }
  revalidatePath(`/invoices/${id}`);
}
