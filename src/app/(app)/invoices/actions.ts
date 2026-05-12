"use server";

import { getSessionAndOrg } from "@/lib/org";
import { getStripe } from "@/lib/stripe";
import { sendEmail, receiptHtml } from "@/lib/email";
import { uploadHtmlToDrive } from "@/lib/drive-uploader";
import { invoiceHtml } from "@/lib/document-html";
import { nextDocumentNumber, documentLabel } from "@/lib/document-number";
import { formatCurrency, formatDate, customerDisplayName } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type LineItem = { description: string; quantity: number; unit_price: number; photos: string[] };

function parseLineItems(formData: FormData): LineItem[] {
  const descs = formData.getAll("li_description") as string[];
  const qtys = formData.getAll("li_quantity") as string[];
  const prices = formData.getAll("li_unit_price") as string[];
  const photoStrs = formData.getAll("li_photos") as string[];
  const out: LineItem[] = [];
  for (let i = 0; i < descs.length; i++) {
    const d = (descs[i] || "").trim();
    if (!d) continue;
    let urls: string[] = [];
    try {
      const parsed = JSON.parse(photoStrs[i] || "[]");
      if (Array.isArray(parsed)) urls = parsed.filter((u) => typeof u === "string");
    } catch {}
    out.push({ description: d, quantity: Number(qtys[i] || 1), unit_price: Number(prices[i] || 0), photos: urls });
  }
  return out;
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

  const invoice_number = await nextDocumentNumber(supabase, organizationId);

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
        total: i.quantity * i.unit_price,
        sort_order: idx,
        photo_urls: i.photos,
      })),
    );
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${inv.id}`);
}

/**
 * Edit a draft invoice's line items, notes, terms, tax rate, and discount.
 * Only allowed while the invoice is in `draft` state — once sent, the line
 * items are frozen so the customer never sees an invoice change underneath
 * them. Replaces line items wholesale and recomputes totals.
 */
export async function updateInvoice(id: string, formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: existing } = await supabase
    .from("invoices")
    .select("status, stripe_payment_link")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!existing) throw new Error("Invoice not found");
  if (existing.status !== "draft") {
    throw new Error("Only draft invoices can be edited. Mark this one as draft first if you need to make changes.");
  }

  const tax_rate = Number(formData.get("tax_rate") || 0);
  const discount_amount = Number(formData.get("discount_amount") || 0);
  const items = parseLineItems(formData);
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const tax_amount = Math.max(0, subtotal - discount_amount) * tax_rate;
  const total = Math.max(0, subtotal - discount_amount) + tax_amount;
  const notes = String(formData.get("notes") || "").trim() || null;
  const terms = String(formData.get("terms") || "").trim() || null;

  await supabase
    .from("invoices")
    .update({
      tax_rate,
      discount_amount,
      tax_amount,
      subtotal,
      total,
      balance_due: total,
      notes,
      terms,
      // If the total changed, the existing Stripe payment link is stale — clear it.
      stripe_payment_link: existing.stripe_payment_link ? null : existing.stripe_payment_link,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId);

  // Replace line items wholesale (simpler than diffing).
  await supabase.from("invoice_line_items").delete().eq("invoice_id", id);
  if (items.length) {
    await supabase.from("invoice_line_items").insert(
      items.map((i, idx) => ({
        invoice_id: id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.quantity * i.unit_price,
        sort_order: idx,
        photo_urls: i.photos,
      })),
    );
  }

  revalidatePath(`/invoices/${id}`);
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
      invoiceNumber: documentLabel("invoice", "paid", inv.invoice_number),
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
      subject: `Receipt — ${documentLabel("invoice", "paid", inv.invoice_number)}`,
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
    metadata: {
      invoice_id: inv.id,
      organization_id: organizationId,
      invoice_number: inv.invoice_number,
      invoice_label: documentLabel("invoice", inv.status, inv.invoice_number),
    },
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
    invoiceNumber: documentLabel("invoice", inv.status, inv.invoice_number),
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
  // Auto-create the Stripe payment link first if Stripe is configured and we don't have one yet.
  let paymentLink: string | null = null;
  {
    const { inv: pre } = await loadInvoiceForDoc(id);
    paymentLink = pre.stripe_payment_link ?? null;
    if (!paymentLink && getStripe()) {
      try {
        await createStripePaymentLink(id);
      } catch (e) {
        // If Stripe fails, still send the invoice without the link.
        console.error("Stripe link generation failed:", e);
      }
    }
  }

  const { organization, inv } = await loadInvoiceForDoc(id);
  const cust: any = inv.customers;
  if (!cust?.email) throw new Error("Customer has no email.");

  const items = (inv.invoice_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const docHtml = invoiceHtml({
    org: organization,
    customer: cust,
    invoiceNumber: documentLabel("invoice", inv.status, inv.invoice_number),
    issueDate: inv.issue_date,
    dueDate: inv.due_date,
    items: items.map((li) => ({ description: li.description, quantity: Number(li.quantity), unit_price: Number(li.unit_price), total: Number(li.total) })),
    subtotal: Number(inv.subtotal), discount: Number(inv.discount_amount), taxRate: Number(inv.tax_rate),
    tax: Number(inv.tax_amount), total: Number(inv.total),
    amountPaid: Number(inv.amount_paid), balanceDue: Number(inv.balance_due),
    notes: inv.notes, terms: inv.terms, paid: inv.status === "paid",
    currency: organization?.currency,
  });

  // Prepend a "Pay now" call-to-action when we have a Stripe link
  const html = inv.stripe_payment_link
    ? `<!doctype html><body style="font-family:system-ui,sans-serif;background:#f8fafc;padding:24px;">
        <div style="max-width:560px;margin:0 auto 16px;text-align:center;">
          <a href="${inv.stripe_payment_link}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;border-radius:8px;font-size:16px;">Pay invoice online →</a>
          <p style="font-size:12px;color:#64748b;margin-top:8px;">Secure payment via Stripe</p>
        </div>
      </body></html>${docHtml}`
    : docHtml;

  const labelForSubject = documentLabel("invoice", inv.status, inv.invoice_number);
  const subject = inv.status === "paid"
    ? `Receipt — ${labelForSubject}`
    : `${labelForSubject} from ${organization?.name}`;
  await sendEmail({ to: cust.email, subject, html, replyTo: organization?.email ?? undefined });
  await setInvoiceStatus(id, inv.status === "draft" ? "sent" : inv.status);
}

/**
 * Create a Stripe PaymentIntent for the in-app virtual terminal. The owner
 * collects card details via Stripe Elements on the client; Stripe.js confirms
 * the intent client-side with the returned client_secret. After success, the
 * client calls confirmManualCardPayment to write the payment row.
 */
export async function createCardChargeIntent(
  invoiceId: string,
  amount: number,
): Promise<{ clientSecret: string; intentId: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured. Set STRIPE_SECRET_KEY in .env.local.");
  if (!(amount > 0)) throw new Error("Amount must be greater than 0.");
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { data: inv } = await supabase
    .from("invoices")
    .select("balance_due, invoice_number, customer_id, customers(email)")
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .single();
  if (!inv) throw new Error("Invoice not found");

  const currency = (organization?.currency ?? "USD").toLowerCase();
  const customerEmail = (inv.customers as any)?.email ?? undefined;

  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency,
    receipt_email: customerEmail,
    description: `Manual card entry — ${documentLabel("invoice", null, inv.invoice_number)}`,
    metadata: {
      invoice_id: invoiceId,
      organization_id: organizationId,
      invoice_number: inv.invoice_number,
      source: "manual_card_entry",
    },
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
  });
  if (!intent.client_secret) throw new Error("Stripe returned no client_secret.");
  return { clientSecret: intent.client_secret, intentId: intent.id };
}

/**
 * Called by the virtual-terminal client component after Stripe.js confirms the
 * payment intent. Verifies with Stripe server-side, then writes the payment
 * row + updates the invoice + sends the receipt — mirroring the recordPayment
 * cash/check/ACH path.
 */
export async function confirmManualCardPayment(invoiceId: string, intentId: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured.");
  const { supabase, organizationId, organization } = await getSessionAndOrg();

  const intent = await stripe.paymentIntents.retrieve(intentId);
  if (intent.status !== "succeeded") {
    throw new Error(`Payment is not in succeeded state (status: ${intent.status}).`);
  }
  if (intent.metadata?.invoice_id !== invoiceId) {
    throw new Error("Payment intent does not belong to this invoice.");
  }

  // Idempotency: bail if we've already recorded a payment for this intent.
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle();
  if (existing) {
    revalidatePath(`/invoices/${invoiceId}`);
    return;
  }

  const amount = (intent.amount ?? 0) / 100;
  const lastChargeId = typeof (intent as any).latest_charge === "string" ? (intent as any).latest_charge : null;

  const { data: inv } = await supabase
    .from("invoices")
    .select("total, amount_paid, invoice_number, customer_id, customers(first_name, last_name, company_name, email)")
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .single();
  if (!inv) throw new Error("Invoice not found.");

  const { data: payment } = await supabase
    .from("payments")
    .insert({
      organization_id: organizationId,
      invoice_id: invoiceId,
      customer_id: inv.customer_id,
      amount,
      payment_method: "card",
      payment_date: new Date().toISOString().slice(0, 10),
      reference_number: lastChargeId ?? intentId,
      notes: "Manual card entry (virtual terminal)",
      stripe_payment_intent_id: intentId,
    })
    .select("id")
    .single();

  const new_paid = Number(inv.amount_paid ?? 0) + amount;
  const balance = Math.max(0, Number(inv.total ?? 0) - new_paid);
  const status = balance === 0 ? "paid" : "partial";
  const patch: any = { amount_paid: new_paid, balance_due: balance, status };
  if (status === "paid") patch.paid_at = new Date().toISOString();
  await supabase.from("invoices").update(patch).eq("id", invoiceId);

  // Send PAID receipt if customer has email
  const cust: any = inv.customers;
  if (cust?.email) {
    const currency = organization?.currency ?? "USD";
    const html = receiptHtml({
      orgName: organization?.name ?? "Your Business",
      orgEmail: organization?.email ?? null,
      invoiceNumber: documentLabel("invoice", status, inv.invoice_number),
      customerName: customerDisplayName(cust),
      amount: formatCurrency(amount, currency),
      paymentMethod: "card",
      paymentDate: formatDate(new Date()),
      total: formatCurrency(Number(inv.total), currency),
      remainingBalance: formatCurrency(balance, currency),
      fullyPaid: balance === 0,
    });
    const result = await sendEmail({
      to: cust.email,
      subject: `Receipt — ${documentLabel("invoice", status, inv.invoice_number)}`,
      html,
      replyTo: organization?.email ?? undefined,
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

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/payments");
}

/**
 * Send a "PAID" stamped receipt email to the customer and log it to
 * receipt_log so the workflow shows the receipt step as complete.
 *
 * Used by the "Send receipt" next-step banner button. Unlike
 * emailInvoiceToCustomer, this always uses the receipt template
 * (not the invoice template) and always writes to receipt_log so the
 * workflow flag flips to "Receipt sent".
 */
export async function sendReceiptToCustomer(invoiceId: string) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { data: inv } = await supabase
    .from("invoices")
    .select("invoice_number, total, amount_paid, balance_due, status, customer_id, customers(first_name, last_name, company_name, email)")
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .single();
  if (!inv) throw new Error("Invoice not found");
  const cust: any = inv.customers;
  if (!cust?.email) throw new Error("Customer has no email on file.");

  const { data: lastPayment } = await supabase
    .from("payments")
    .select("amount, payment_method, payment_date")
    .eq("invoice_id", invoiceId)
    .eq("organization_id", organizationId)
    .order("payment_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currency = organization?.currency ?? "USD";
  const total = Number(inv.total ?? 0);
  const paid = Number(inv.amount_paid ?? 0);
  const balance = Number(inv.balance_due ?? 0);
  const html = receiptHtml({
    orgName: organization?.name ?? "Your Business",
    orgEmail: organization?.email ?? null,
    invoiceNumber: documentLabel("invoice", "paid", inv.invoice_number),
    customerName: customerDisplayName(cust),
    amount: formatCurrency(lastPayment?.amount ? Number(lastPayment.amount) : paid, currency),
    paymentMethod: String(lastPayment?.payment_method ?? "—"),
    paymentDate: formatDate(lastPayment?.payment_date ?? new Date()),
    total: formatCurrency(total, currency),
    remainingBalance: formatCurrency(balance, currency),
    fullyPaid: balance === 0,
  });

  const result = await sendEmail({
    to: cust.email,
    subject: `Receipt — ${documentLabel("invoice", "paid", inv.invoice_number)}`,
    html,
    replyTo: organization?.email ?? undefined,
  });
  if (!result.ok) {
    throw new Error(`Failed to send receipt: ${result.reason ?? "email not configured"}`);
  }
  await supabase.from("receipt_log").insert({
    organization_id: organizationId,
    invoice_id: invoiceId,
    customer_id: inv.customer_id,
    email_to: cust.email,
    provider: "resend",
    provider_id: result.id ?? null,
    status: "sent",
  });
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function deleteInvoice(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("invoices").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/invoices");
  redirect("/invoices");
}
