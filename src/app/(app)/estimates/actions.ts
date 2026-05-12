"use server";

import { getSessionAndOrg } from "@/lib/org";
import { sendEmail } from "@/lib/email";
import { sendSMS, bestCustomerPhone, isSMSConfigured } from "@/lib/sms";
import { uploadHtmlToDrive, uploadPdfToDrive } from "@/lib/drive-uploader";
import { estimateHtml } from "@/lib/document-html";
import { estimatePdfBuffer } from "@/lib/document-pdf";
import { nextDocumentNumber, documentLabel } from "@/lib/document-number";
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
    out.push({
      description: d,
      quantity: Number(qtys[i] || 1),
      unit_price: Number(prices[i] || 0),
      photos: urls,
    });
  }
  return out;
}

export async function createEstimate(formData: FormData) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const customer_id = String(formData.get("customer_id") || "");
  if (!customer_id) throw new Error("Customer required");

  const property_id = (String(formData.get("property_id") || "") || null) as string | null;
  const issue_date = String(formData.get("issue_date") || new Date().toISOString().slice(0, 10));
  // 30-day default expiry from issue date
  const defaultExpiry = new Date(issue_date);
  defaultExpiry.setDate(defaultExpiry.getDate() + 30);
  const expires_at = String(formData.get("expires_at") || "") || defaultExpiry.toISOString().slice(0, 10);
  const tax_rate = Number(formData.get("tax_rate") || 0);
  const discount_amount = Number(formData.get("discount_amount") || 0);
  const notes = String(formData.get("notes") || "").trim() || null;
  const terms = String(formData.get("terms") || "").trim() || null;
  const duration_minutes = Number(formData.get("duration_minutes") || 0) || null;
  const buffer_minutes = Number(formData.get("buffer_minutes") || 30);
  const items = parseLineItems(formData);

  let subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  // Apply global min job price
  const globalMin = Number(organization?.global_min_job_price ?? 0);
  if (globalMin > 0 && subtotal < globalMin) {
    subtotal = globalMin;
    if (items.length === 0) {
      items.push({ description: "Minimum service charge", quantity: 1, unit_price: globalMin, photos: [] });
    }
  }

  const tax_amount = Math.max(0, subtotal - discount_amount) * tax_rate;
  const total = Math.max(0, subtotal - discount_amount) + tax_amount;

  // Auto-deposit if total exceeds threshold
  const depositThreshold = Number(organization?.deposit_threshold ?? 0);
  const depositPct = Number(organization?.deposit_percentage ?? 0.25);
  const deposit_amount = depositThreshold > 0 && total >= depositThreshold ? Math.round(total * depositPct * 100) / 100 : null;

  const estimate_number = await nextDocumentNumber(supabase, organizationId);
  const approval_token = crypto.randomUUID().replace(/-/g, "");

  const { data: est, error } = await supabase
    .from("estimates")
    .insert({
      organization_id: organizationId, customer_id, property_id, estimate_number,
      issue_date, expires_at, tax_rate, discount_amount, tax_amount, subtotal, total,
      notes, terms, status: "draft",
      duration_minutes, buffer_minutes, deposit_amount, approval_token,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (items.length) {
    await supabase.from("estimate_line_items").insert(
      items.map((i, idx) => ({
        estimate_id: est.id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.quantity * i.unit_price,
        sort_order: idx,
        photo_urls: i.photos,
      })),
    );
  }

  revalidatePath("/estimates");
  redirect(`/estimates/${est.id}`);
}

/**
 * Edit an estimate's line items, notes, terms, tax rate, and discount.
 * Allowed in any status — when the estimate is no longer in draft, the
 * detail page will surface a "Re-send to customer" CTA because updated_at
 * will be more recent than sent_at.
 */
export async function updateEstimate(id: string, formData: FormData) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { data: existing } = await supabase
    .from("estimates")
    .select("status")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!existing) throw new Error("Estimate not found");

  const tax_rate = Number(formData.get("tax_rate") || 0);
  const discount_amount = Number(formData.get("discount_amount") || 0);
  const items = parseLineItems(formData);
  let subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const globalMin = Number(organization?.global_min_job_price ?? 0);
  if (globalMin > 0 && subtotal < globalMin) subtotal = globalMin;
  const tax_amount = Math.max(0, subtotal - discount_amount) * tax_rate;
  const total = Math.max(0, subtotal - discount_amount) + tax_amount;
  const notes = String(formData.get("notes") || "").trim() || null;
  const terms = String(formData.get("terms") || "").trim() || null;

  const depositThreshold = Number(organization?.deposit_threshold ?? 0);
  const depositPct = Number(organization?.deposit_percentage ?? 0.25);
  const deposit_amount =
    depositThreshold > 0 && total >= depositThreshold ? Math.round(total * depositPct * 100) / 100 : null;

  await supabase
    .from("estimates")
    .update({
      tax_rate,
      discount_amount,
      tax_amount,
      subtotal,
      total,
      notes,
      terms,
      deposit_amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId);

  await supabase.from("estimate_line_items").delete().eq("estimate_id", id);
  if (items.length) {
    await supabase.from("estimate_line_items").insert(
      items.map((i, idx) => ({
        estimate_id: id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.quantity * i.unit_price,
        sort_order: idx,
        photo_urls: i.photos,
      })),
    );
  }
  revalidatePath(`/estimates/${id}`);
}

export async function setEstimateStatus(id: string, status: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const patch: any = { status };
  if (status === "sent") patch.sent_at = new Date().toISOString();
  if (status === "accepted") patch.accepted_at = new Date().toISOString();
  await supabase.from("estimates").update(patch).eq("id", id).eq("organization_id", organizationId);

  // Owner just accepted an estimate -> mirror what the public approval flow does
  // (accept_estimate_by_token RPC): make sure there is an open job ready to schedule.
  if (status === "accepted") {
    await ensureJobForEstimate(id, "scheduled");
  }

  revalidatePath(`/estimates/${id}`);
  revalidatePath("/jobs");
}

async function ensureJobForEstimate(estimateId: string, jobStatus: "scheduled" | "completed" = "scheduled") {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: existing } = await supabase
    .from("jobs")
    .select("id")
    .eq("estimate_id", estimateId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: est } = await supabase
    .from("estimates")
    .select("customer_id, property_id, estimate_number, total, duration_minutes, buffer_minutes, notes")
    .eq("id", estimateId)
    .eq("organization_id", organizationId)
    .single();
  if (!est) return null;

  const insert: any = {
    organization_id: organizationId,
    customer_id: est.customer_id,
    property_id: est.property_id,
    estimate_id: estimateId,
    job_number: est.estimate_number,
    title: `Job from ${documentLabel("estimate", null, est.estimate_number)}`,
    description: est.notes,
    status: jobStatus,
    total_amount: est.total,
    duration_minutes: est.duration_minutes,
    buffer_minutes: est.buffer_minutes ?? 30,
  };
  if (jobStatus === "completed") {
    insert.actual_end = new Date().toISOString();
  }
  const { data: job } = await supabase.from("jobs").insert(insert).select("id").single();
  return job?.id ?? null;
}

export async function convertEstimateToInvoice(estimateId: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: est } = await supabase
    .from("estimates")
    .select("*, estimate_line_items(*)")
    .eq("id", estimateId)
    .eq("organization_id", organizationId)
    .single();
  if (!est) throw new Error("Estimate not found");

  // Invoice inherits the estimate's bare number so EST-26-1032 -> INVOICE-26-1032 -> RECEIPT-26-1032.
  const invoice_number = est.estimate_number;
  const due_date = new Date();
  due_date.setDate(due_date.getDate() + 14);

  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      organization_id: organizationId,
      customer_id: est.customer_id,
      estimate_id: est.id,
      invoice_number,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: due_date.toISOString().slice(0, 10),
      subtotal: est.subtotal,
      tax_rate: est.tax_rate,
      tax_amount: est.tax_amount,
      discount_amount: est.discount_amount,
      total: est.total,
      balance_due: est.total,
      notes: est.notes,
      terms: est.terms,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (est.estimate_line_items?.length) {
    await supabase.from("invoice_line_items").insert(
      est.estimate_line_items.map((li: any) => ({
        invoice_id: inv.id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        total: li.total,
        sort_order: li.sort_order,
        photo_urls: li.photo_urls ?? [],
      })),
    );
  }
  await supabase.from("estimates").update({ status: "converted" }).eq("id", est.id);

  // Make sure a job exists too, marked completed since we're skipping straight to invoice.
  // Then link the invoice to it so the workflow stepper resolves end-to-end.
  const jobId = await ensureJobForEstimate(est.id, "completed");
  if (jobId) {
    await supabase.from("invoices").update({ job_id: jobId }).eq("id", inv.id);
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${inv.id}`);
}

async function loadEstimateForDoc(id: string) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { data: est } = await supabase
    .from("estimates")
    .select("*, customers(*), estimate_line_items(*)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!est) throw new Error("Estimate not found");
  return { supabase, organizationId, organization, est };
}

function estimateDocHtml(organization: any, est: any) {
  const items = (est.estimate_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return estimateHtml({
    org: organization,
    customer: est.customers as any,
    estimateNumber: est.estimate_number,
    issueDate: est.issue_date,
    expiresAt: est.expires_at,
    items: items.map((li) => ({ description: li.description, quantity: Number(li.quantity), unit_price: Number(li.unit_price), total: Number(li.total) })),
    subtotal: Number(est.subtotal), discount: Number(est.discount_amount), taxRate: Number(est.tax_rate),
    tax: Number(est.tax_amount), total: Number(est.total),
    notes: est.notes, terms: est.terms,
    currency: organization?.currency,
  });
}

export async function saveEstimateToDrive(id: string) {
  const { organizationId, organization, est } = await loadEstimateForDoc(id);
  const items = (est.estimate_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const label = documentLabel("estimate", est.status, est.estimate_number);
  const pdf = await estimatePdfBuffer({
    org: organization,
    customer: est.customers as any,
    estimateNumber: label,
    issueDate: est.issue_date,
    expiresAt: est.expires_at,
    items: items.map((li) => ({
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      total: Number(li.total),
    })),
    subtotal: Number(est.subtotal),
    discount: Number(est.discount_amount),
    taxRate: Number(est.tax_rate),
    tax: Number(est.tax_amount),
    total: Number(est.total),
    notes: est.notes,
    terms: est.terms,
    currency: organization?.currency,
  });
  await uploadPdfToDrive({
    organization_id: organizationId,
    folder: "estimates_folder_id",
    name: `${label}.pdf`,
    pdf,
  });
  revalidatePath(`/estimates/${id}`);
}

export async function emailEstimateToCustomer(id: string) {
  const { organization, est } = await loadEstimateForDoc(id);
  const cust: any = est.customers;
  if (!cust?.email) throw new Error("Customer has no email.");
  await sendEmail({
    to: cust.email,
    subject: `Estimate ${documentLabel("estimate", est.status, est.estimate_number)} from ${organization?.name}`,
    html: estimateDocHtml(organization, est),
    replyTo: organization?.email ?? undefined,
  });
  await setEstimateStatus(id, "sent");
}

/**
 * Send the customer a quote-approval link via SMS. Useful when the customer
 * has no email but has a phone number. Includes the public /quote/<token>
 * URL so the customer can approve from their phone.
 */
export async function smsEstimateToCustomer(id: string) {
  if (!isSMSConfigured()) throw new Error("SMS is not configured. Set Twilio env vars in .env.local.");
  const { supabase, organizationId, organization, est } = await loadEstimateForDoc(id);
  const cust: any = est.customers;
  const phone = bestCustomerPhone(cust);
  if (!phone) throw new Error("Customer has no phone number on file.");
  if (!est.approval_token) throw new Error("This estimate has no approval link.");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const link = `${appUrl}/quote/${est.approval_token}`;
  const label = documentLabel("estimate", est.status, est.estimate_number);
  const body = `${organization?.name ?? "Your quote"}: ${label} is ready. Review & approve here: ${link}`;
  const result = await sendSMS({ to: phone, body });
  if (!result.ok) throw new Error(`SMS send failed: ${result.reason}`);
  await supabase
    .from("estimates")
    .update({ sent_at: new Date().toISOString(), status: est.status === "draft" ? "sent" : est.status })
    .eq("id", id)
    .eq("organization_id", organizationId);
  revalidatePath(`/estimates/${id}`);
}

export async function deleteEstimate(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("estimates").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/estimates");
  redirect("/estimates");
}
