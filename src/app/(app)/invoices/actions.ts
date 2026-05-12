"use server";

import { getSessionAndOrg } from "@/lib/org";
import { getStripe } from "@/lib/stripe";
import { sendEmail, receiptHtml } from "@/lib/email";
import { uploadHtmlToDrive } from "@/lib/drive-uploader";
import { invoiceHtml } from "@/lib/document-html";
import { formatCurrency, formatDate, customerDisplayName } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type LineItem = { description: string; quantity: number; unit_price: number };

function parseLineItems(formData: FormData): LineItem[] {
  const descs = formData.getAll("li_description") as string[];
  const qtys = formData.getAll("li_quantity") as string[];
  const prices = formData.getAll("li_unit_price") as string[];
  const out: LineItem[] = [];
  for (let i = 0; i < descs.length; i++) {
    const d = (descs[i] || "").trim();
    if (!d) continue;
    out.push({ description: d, quantity: Number(qtys[i] || 1), unit_price: Number(prices[i] || 0) });
  }
  return out;
}

async function nextInvoiceNumber(orgId: string, supabase: any) {
  const { data: org } = await supabase.from("organizations").select("next_invoice_number, invoice_prefix").eq("id", orgId).single();
  const num = org?.next_invoice_number ?? 1000;
  const prefix = org?.invoice_prefix ?? "INV";
  await supabase.from("organizations").update({ next_invoice_number: num + 1 }).eq("id", orgId);
  return `${prefix}-${num}`;
}

export async function createInvoice(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const customer_id = String(formData.get("customer_id") || "");
  if (!customer_id) throw new Error("Customer required");

  const due_date = String(formData.get("due_date") || "") || null;
  const issue_date = String(formData.get("issue_date") || new Date().toISOString().slice(0, 10));
  const tax_rate = Number(formData.get("tax_rate") || 0);
  const discount_amount = Number(formData.get("discount_amount") || 0);
  const items = parseLineItems(formData);
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const tax_amount = Math.max(0, subtotal - discount_amount) * tax_rate;
  const total = Math.max(0, subtotal - discount_amount) + tax_amount;
  const notes = String(formData.get("notes") || "").trim() || null;
  const terms = String(formData.get("terms") || "").trim() || null;

  const invoice_number = await nextInvoiceNumber(organizationId, supabase);

  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({ organization_id: organizationId, customer_id, invoice_number, issue_date, due_date, tax_rate, discount_amount, tax_amount, subtotal, total, balance_due: total, notes, terms, status: "draft" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (items.length) {
    await supabase.from("invoice_line_items").insert(
      items.map((i, idx) => ({ invoice_id: inv.id, description: i.description, quantity: i.quantity, unit_price: i.unit_price, total: i.quantity * i.unit_price, sort_order: idx })),
    );
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${inv.id}`);
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
  const amount = Number(formData.get("amount") || 0);
  if (amount <= 0) throw new Error("Amount must be > 0");
  const payment_method = String(formData.get("payment_method") || "cash");
  const payment_date = String(formData.get("payment_date") || new Date().toISOString().slice(0, 10));
  const reference_number = String(formData.get("reference_number") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

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

  // Send receipt if customer has email and email is configured
  const cust: any = inv.customers;
  const sendReceipt = String(formData.get("send_receipt") || "on") === "on";
  if (sendReceipt && cust?.email) {
    const { data: org } = await supabase.from("organizations").select("name, email, currency").eq("id", organizationId).single();
    const html = receiptHtml({
      orgName: org?.name ?? "Your Business",
      orgEmail: org?.email ?? null,
      invoiceNumber: inv.invoice_number,
      customerName: customerDisplayName(cust),
      amount: formatCurrency(amount, org?.currency ?? "USD"),
      paymentMethod: payment_method,
      paymentDate: formatDate(payment_date),
      total: formatCurrency(Number(inv.total), org?.currency ?? "USD"),
      remainingBalance: formatCurrency(balance, org?.currency ?? "USD"),
      fullyPaid: balance === 0,
    });
    const result = await sendEmail({
      to: cust.email,
      subject: `Receipt — Invoice ${inv.invoice_number}`,
      html,
      replyTo: org?.email ?? undefined,
    });
    if (result.ok) {
      await supabase.from("receipt_log").insert({
        organization_id: organizationId,
        invoice_id: invoiceId,
        payment_id: payment?.id ?? null,
        customer_id: inv.customer_id,
        email_to: cust.email,
        provider: "resend",
        provider_id: result.id ?? null,
        status: "sent",
      });
    }
  }

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
      await sendEmail({ to: cust.email, subject, html, replyTo: org.email ?? undefined });
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

  const currency = (organization?.currency || "USD").toLowerCase();
  // Stripe payment links require pre-created prices. We pre-create on-the-fly prices via products,
  // then use those price IDs in the payment link.
  const priceIds: { price: string; quantity: number }[] = [];
  for (const li of inv.invoice_line_items as any[]) {
    const product = await stripe.products.create({ name: li.description });
    const price = await stripe.prices.create({
      product: product.id,
      currency,
      unit_amount: Math.round(Number(li.unit_price || 0) * 100),
    });
    priceIds.push({ price: price.id, quantity: Math.max(1, Math.round(Number(li.quantity || 1))) });
  }

  const link = await stripe.paymentLinks.create({
    line_items: priceIds,
    metadata: { invoice_id: inv.id, organization_id: organizationId, invoice_number: inv.invoice_number },
  });

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
    items: items.map((li) => ({ description: li.description, quantity: Number(li.quantity), unit_price: Number(li.unit_price), total: Number(li.total) })),
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
  const { organization, inv } = await loadInvoiceForDoc(id);
  const cust: any = inv.customers;
  if (!cust?.email) throw new Error("Customer has no email.");
  const items = (inv.invoice_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const html = invoiceHtml({
    org: organization,
    customer: cust,
    invoiceNumber: inv.invoice_number,
    issueDate: inv.issue_date,
    dueDate: inv.due_date,
    items: items.map((li) => ({ description: li.description, quantity: Number(li.quantity), unit_price: Number(li.unit_price), total: Number(li.total) })),
    subtotal: Number(inv.subtotal), discount: Number(inv.discount_amount), taxRate: Number(inv.tax_rate),
    tax: Number(inv.tax_amount), total: Number(inv.total),
    amountPaid: Number(inv.amount_paid), balanceDue: Number(inv.balance_due),
    notes: inv.notes, terms: inv.terms, paid: inv.status === "paid",
    currency: organization?.currency,
  });
  const subject = inv.status === "paid" ? `Receipt — Invoice ${inv.invoice_number}` : `Invoice ${inv.invoice_number} from ${organization?.name}`;
  await sendEmail({ to: cust.email, subject, html, replyTo: organization?.email ?? undefined });
  await setInvoiceStatus(id, inv.status === "draft" ? "sent" : inv.status);
}

export async function deleteInvoice(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("invoices").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/invoices");
  redirect("/invoices");
}
