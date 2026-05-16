"use server";

import { getSessionAndOrg } from "@/lib/org";
import { sendEmail } from "@/lib/email";
import { uploadHtmlToDrive } from "@/lib/drive-uploader";
import { estimateHtml } from "@/lib/document-html";
import { estimateSchema, parseForm } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type LineItem = { description: string; quantity: number; unit_price: number; photos: string[] };

async function nextNumber(prefix: string, orgId: string, supabase: any, field: "next_estimate_number" | "next_invoice_number") {
  const { data: org } = await supabase.from("organizations").select(`${field}, ${field === "next_estimate_number" ? "estimate_prefix" : "invoice_prefix"}`).eq("id", orgId).single();
  const current = org?.[field] ?? 1000;
  const p = prefix || org?.[field === "next_estimate_number" ? "estimate_prefix" : "invoice_prefix"] || (field === "next_estimate_number" ? "EST" : "INV");
  await supabase.from("organizations").update({ [field]: current + 1 }).eq("id", orgId);
  return `${p}-${current}`;
}

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
  const validated = parseForm(estimateSchema, formData);
  const customer_id = validated.customer_id;
  const property_id = validated.property_id ?? null;
  const issue_date = validated.issue_date || new Date().toISOString().slice(0, 10);
  // 30-day default expiry from issue date
  const defaultExpiry = new Date(issue_date);
  defaultExpiry.setDate(defaultExpiry.getDate() + 30);
  const expires_at = validated.expires_at || defaultExpiry.toISOString().slice(0, 10);
  const tax_rate = validated.tax_rate ?? 0;
  const discount_amount = validated.discount_amount ?? 0;
  const notes = validated.notes ?? null;
  const terms = validated.terms ?? null;
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

  const estimate_number = await nextNumber("EST", organizationId, supabase, "next_estimate_number");
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

export async function setEstimateStatus(id: string, status: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: before } = await supabase
    .from("estimates")
    .select("estimate_number, status, customer_id, total, customers(first_name, last_name, company_name)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  const patch: any = { status };
  if (status === "sent") patch.sent_at = new Date().toISOString();
  if (status === "accepted") patch.accepted_at = new Date().toISOString();
  await supabase.from("estimates").update(patch).eq("id", id).eq("organization_id", organizationId);

  await logAudit({
    organizationId,
    action: status === "sent" ? "send" : "update",
    entityType: "estimate",
    entityId: id,
    entityLabel: before?.estimate_number ?? null,
    before: { status: before?.status },
    after: { status },
  });

  // Owner just accepted an estimate -> mirror what the public approval flow does
  // (accept_estimate_by_token RPC): make sure there is an open job ready to schedule.
  if (status === "accepted") {
    await ensureJobForEstimate(id, "scheduled");
    const c: any = before?.customers;
    const name = c ? (c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()) : "customer";
    await notify(supabase as any, {
      organizationId,
      kind: "estimate_accepted",
      title: `Estimate accepted — ${before?.estimate_number ?? ""}`,
      body: `${name} accepted your estimate`,
      entityType: "estimate",
      entityId: id,
      url: `/estimates/${id}`,
    });
  }
  if (status === "declined") {
    await notify(supabase as any, {
      organizationId,
      kind: "estimate_declined",
      title: `Estimate declined — ${before?.estimate_number ?? ""}`,
      entityType: "estimate",
      entityId: id,
      url: `/estimates/${id}`,
    });
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
    title: `Job from ${est.estimate_number}`,
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

  const invoice_number = await nextNumber("INV", organizationId, supabase, "next_invoice_number");
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
  await uploadHtmlToDrive({
    organization_id: organizationId,
    folder: "estimates_folder_id",
    name: `${est.estimate_number}.html`,
    html: estimateDocHtml(organization, est),
  });
  revalidatePath(`/estimates/${id}`);
}

export async function emailEstimateToCustomer(id: string) {
  const { organization, est } = await loadEstimateForDoc(id);
  const cust: any = est.customers;
  if (!cust?.email) throw new Error("Customer has no email.");
  await sendEmail({
    to: cust.email,
    subject: `Estimate ${est.estimate_number} from ${organization?.name}`,
    html: estimateDocHtml(organization, est),
    replyTo: organization?.email ?? undefined,
  });
  await setEstimateStatus(id, "sent");
}

// Send the estimate via a pre-made template (email or SMS).
// `channel` = "email" | "sms"
export async function sendEstimateViaTemplate(id: string, channel: "email" | "sms") {
  const { sendTemplated, appUrl } = await import("@/lib/messaging");
  const { formatCurrency } = await import("@/lib/utils");
  const { supabase, organizationId, organization, est } = await loadEstimateForDoc(id);
  const cust: any = est.customers;
  const approvalUrl = est.approval_token ? `${appUrl()}/quote/${est.approval_token}` : "";

  const result = await sendTemplated({
    supabase: supabase as any,
    organizationId,
    customerId: cust?.id ?? null,
    kind: "estimate_send",
    channel,
    to: { email: cust?.email, phone: cust?.phone || cust?.mobile_phone },
    replyToEmail: organization?.email,
    relatedKind: "estimate",
    relatedId: id,
    vars: {
      org_name: organization?.name ?? "",
      org_phone: organization?.phone ?? "",
      customer_first_name: cust?.first_name ?? cust?.company_name ?? "there",
      estimate_number: est.estimate_number,
      estimate_total: formatCurrency(Number(est.total ?? 0), organization?.currency ?? "USD"),
      expires_at: est.expires_at ?? "",
      approval_url: approvalUrl,
    },
  });
  if (!result.ok) throw new Error(result.reason);
  await setEstimateStatus(id, "sent");
  revalidatePath(`/estimates/${id}`);
}

export async function updateEstimate(id: string, formData: FormData) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { data: before } = await supabase
    .from("estimates")
    .select("estimate_number, status")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!before) throw new Error("Estimate not found");
  if (before.status === "converted" || before.status === "accepted") {
    throw new Error("This estimate is locked. Revert its status first to edit.");
  }

  const validated = parseForm(estimateSchema, formData);
  const issue_date = validated.issue_date || new Date().toISOString().slice(0, 10);
  const expires_at = validated.expires_at || null;
  const tax_rate = validated.tax_rate ?? 0;
  const discount_amount = validated.discount_amount ?? 0;
  const duration_minutes = Number(formData.get("duration_minutes") || 0) || null;
  const buffer_minutes = Number(formData.get("buffer_minutes") || 30);
  const items = parseLineItems(formData);
  const notes = validated.notes ?? null;
  const terms = validated.terms ?? null;

  let subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const globalMin = Number(organization?.global_min_job_price ?? 0);
  if (globalMin > 0 && subtotal < globalMin) {
    subtotal = globalMin;
  }
  const tax_amount = Math.max(0, subtotal - discount_amount) * tax_rate;
  const total = Math.max(0, subtotal - discount_amount) + tax_amount;
  const depositThreshold = Number(organization?.deposit_threshold ?? 0);
  const depositPct = Number(organization?.deposit_percentage ?? 0.25);
  const deposit_amount = depositThreshold > 0 && total >= depositThreshold ? Math.round(total * depositPct * 100) / 100 : null;

  await supabase.from("estimates").update({
    issue_date, expires_at,
    tax_rate, discount_amount, tax_amount, subtotal, total,
    duration_minutes, buffer_minutes, deposit_amount,
    notes, terms,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("organization_id", organizationId);

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

  await logAudit({
    organizationId,
    action: "update",
    entityType: "estimate",
    entityId: id,
    entityLabel: before.estimate_number,
    after: { subtotal, total, line_items: items.length },
  });

  // Clear any auto-save draft for this estimate
  await supabase.from("drafts").delete().eq("entity_type", "estimate").eq("entity_id", id);

  revalidatePath(`/estimates/${id}`);
  revalidatePath("/estimates");
  redirect(`/estimates/${id}`);
}

export async function deleteEstimate(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: before } = await supabase
    .from("estimates")
    .select("id, estimate_number, total, status")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  await supabase.from("estimates").delete().eq("id", id).eq("organization_id", organizationId);
  await logAudit({
    organizationId,
    action: "delete",
    entityType: "estimate",
    entityId: id,
    entityLabel: before?.estimate_number ?? null,
    before,
  });
  revalidatePath("/estimates");
  redirect("/estimates");
}
