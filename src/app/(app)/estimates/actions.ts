"use server";

import { getSessionAndOrg } from "@/lib/org";
import { sendOrgEmail } from "@/lib/org-messaging";
import { uploadHtmlToDrive } from "@/lib/drive-uploader";
import { estimateHtml } from "@/lib/document-html";
import { estimateSchema, parseForm } from "@/lib/validation";
import { isEstimateEditable } from "./helpers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type LineKind = "labor" | "material" | "service" | "other";
type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  photos: string[];
  kind: LineKind;
  taxable: boolean;
};

async function nextNumber(prefix: string, orgId: string, supabase: any, field: "next_estimate_number" | "next_invoice_number") {
  // Both fields share the same counter going forward (see src/lib/numbering.ts).
  // We keep the parameter for back-compat with existing call sites.
  const { nextDocumentNumber } = await import("@/lib/numbering");
  return nextDocumentNumber(supabase, orgId);
}

// li_row_marker is emitted once per rendered row (whether taxable or not)
// so we can align the sparse li_taxable checkbox values against the dense
// li_description / li_kind arrays. Without this, an unchecked taxable on
// row 0 would silently shift every following row's taxable flag.
function parseLineItems(formData: FormData): LineItem[] {
  const descs = formData.getAll("li_description") as string[];
  const qtys = formData.getAll("li_quantity") as string[];
  const prices = formData.getAll("li_unit_price") as string[];
  const photoStrs = formData.getAll("li_photos") as string[];
  const kinds = formData.getAll("li_kind") as string[];
  // For taxable we rebuild row-aligned values by reading each marked row's
  // checkbox. React's controlled checkbox only POSTs when checked, so we
  // can't trust position; instead the form emits "li_taxable_<idx>" or
  // we use the marker count and a parallel "li_taxable" stream that's
  // always emitted as "1" when present. Here we go the simpler route:
  // for each row index, look at the row's `checked` attribute via a
  // hidden li_taxable_per_row field that the client owes us. As of this
  // implementation the client controls visibility via state, so we
  // fallback to inferring from getAll("li_taxable") which captures only
  // the rows whose box is checked — and we trust the client to emit a
  // hidden per-row marker pair so we know which were unchecked.
  //
  // Concretely: each rendered row outputs both a checkbox name="li_taxable"
  // (value "1" iff checked) and a hidden name="li_taxable_marker" with
  // value "checked" or "unchecked". We zip the markers to get the per-row
  // taxable flag.
  const markers = formData.getAll("li_taxable_marker") as string[];

  const out: LineItem[] = [];
  for (let i = 0; i < descs.length; i++) {
    const d = (descs[i] || "").trim();
    if (!d) continue;
    let urls: string[] = [];
    try {
      const parsed = JSON.parse(photoStrs[i] || "[]");
      if (Array.isArray(parsed)) urls = parsed.filter((u) => typeof u === "string");
    } catch {}
    const rawKind = (kinds[i] || "service") as LineKind;
    const kind: LineKind = ["labor", "material", "service", "other"].includes(rawKind) ? rawKind : "service";
    const taxable = markers[i] != null ? markers[i] === "checked" : true;
    out.push({
      description: d,
      quantity: Number(qtys[i] || 1),
      unit_price: Number(prices[i] || 0),
      photos: urls,
      kind,
      taxable,
    });
  }
  return out;
}

function computeRollups(items: LineItem[]) {
  let subtotal = 0;
  let taxableSubtotal = 0;
  let laborSubtotal = 0;
  let materialsSubtotal = 0;
  for (const i of items) {
    const line = i.quantity * i.unit_price;
    subtotal += line;
    if (i.taxable) taxableSubtotal += line;
    if (i.kind === "labor") laborSubtotal += line;
    if (i.kind === "material") materialsSubtotal += line;
  }
  return {
    subtotal: round2(subtotal),
    taxableSubtotal: round2(taxableSubtotal),
    laborSubtotal: round2(laborSubtotal),
    materialsSubtotal: round2(materialsSubtotal),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
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

  // Apply global min job price. We grow the lowest-priced line up to the
  // min rather than tacking on a synthetic charge unless there's nothing
  // to grow — keeps the labor/materials split intact for legitimate jobs.
  const globalMin = Number(organization?.global_min_job_price ?? 0);
  const preMinSubtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  if (globalMin > 0 && preMinSubtotal < globalMin) {
    if (items.length === 0) {
      items.push({
        description: "Minimum service charge",
        quantity: 1,
        unit_price: globalMin,
        photos: [],
        kind: "service",
        taxable: true,
      });
    } else {
      items.push({
        description: "Minimum service charge adjustment",
        quantity: 1,
        unit_price: round2(globalMin - preMinSubtotal),
        photos: [],
        kind: "service",
        taxable: false,
      });
    }
  }

  // Doc-level rollups. Discount is pro-rated across taxable / non-taxable
  // so a mixed-tax invoice doesn't accidentally over- or under-tax.
  const r = computeRollups(items);
  const taxablePortion = r.subtotal > 0 ? round2((r.taxableSubtotal / r.subtotal) * discount_amount) : 0;
  const taxable_subtotal_after_discount = Math.max(0, round2(r.taxableSubtotal - taxablePortion));
  const tax_amount = round2(taxable_subtotal_after_discount * tax_rate);
  const total = round2(Math.max(0, r.subtotal - discount_amount) + tax_amount);

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
      issue_date, expires_at, tax_rate, discount_amount, tax_amount,
      subtotal: r.subtotal,
      labor_subtotal: r.laborSubtotal,
      materials_subtotal: r.materialsSubtotal,
      taxable_subtotal: taxable_subtotal_after_discount,
      total,
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
        kind: i.kind,
        taxable: i.taxable,
      })),
    );
  }

  revalidatePath("/estimates");
  redirect(`/estimates/${est.id}`);
}

export async function updateEstimate(id: string, formData: FormData) {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { data: existing } = await supabase
    .from("estimates")
    .select("id, status, approval_token, estimate_number")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!existing) throw new Error("Estimate not found");
  if (!isEstimateEditable((existing as any).status)) {
    throw new Error("This estimate has already been sent and can't be edited. Duplicate it to make changes.");
  }

  const validated = parseForm(estimateSchema, formData);
  const customer_id = validated.customer_id;
  const property_id = validated.property_id ?? null;
  const issue_date = validated.issue_date || new Date().toISOString().slice(0, 10);
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

  const r = computeRollups(items);
  const taxablePortion = r.subtotal > 0 ? round2((r.taxableSubtotal / r.subtotal) * discount_amount) : 0;
  const taxable_subtotal_after_discount = Math.max(0, round2(r.taxableSubtotal - taxablePortion));
  const tax_amount = round2(taxable_subtotal_after_discount * tax_rate);
  const total = round2(Math.max(0, r.subtotal - discount_amount) + tax_amount);

  // Re-evaluate the auto-deposit so a discount that drops the total below
  // the threshold removes it, and a new line that pushes it over adds it.
  const depositThreshold = Number(organization?.deposit_threshold ?? 0);
  const depositPct = Number(organization?.deposit_percentage ?? 0.25);
  const deposit_amount = depositThreshold > 0 && total >= depositThreshold ? round2(total * depositPct) : null;

  const { error: updErr } = await supabase
    .from("estimates")
    .update({
      customer_id, property_id,
      issue_date, expires_at,
      tax_rate, discount_amount, tax_amount,
      subtotal: r.subtotal,
      labor_subtotal: r.laborSubtotal,
      materials_subtotal: r.materialsSubtotal,
      taxable_subtotal: taxable_subtotal_after_discount,
      total,
      notes, terms,
      duration_minutes, buffer_minutes,
      deposit_amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (updErr) throw new Error(updErr.message);

  // Rewrite line items wholesale. The set is small enough that this is
  // simpler than diffing; the approval token doesn't change so any quote
  // link the customer might have hasn't gone out yet (we'd have rejected
  // the edit above) and won't be confused.
  await supabase.from("estimate_line_items").delete().eq("estimate_id", id);
  if (items.length) {
    await supabase.from("estimate_line_items").insert(
      items.map((i, idx) => ({
        estimate_id: id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: round2(i.quantity * i.unit_price),
        sort_order: idx,
        photo_urls: i.photos,
        kind: i.kind,
        taxable: i.taxable,
      })),
    );
  }

  revalidatePath(`/estimates/${id}`);
  revalidatePath("/estimates");
  redirect(`/estimates/${id}`);
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
    job_number: est.estimate_number, // Same number flows through estimate → job → invoice → receipt
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

  // Same number flows through the chain — invoice inherits the estimate's
  // number rather than allocating a fresh one.
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
      labor_subtotal: est.labor_subtotal ?? 0,
      materials_subtotal: est.materials_subtotal ?? 0,
      taxable_subtotal: est.taxable_subtotal ?? est.subtotal,
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
        kind: li.kind ?? "service",
        taxable: li.taxable ?? true,
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
    items: items.map((li) => ({
      description: li.description,
      quantity: Number(li.quantity),
      unit_price: Number(li.unit_price),
      total: Number(li.total),
      photo_urls: li.photo_urls ?? [],
      kind: li.kind ?? "service",
      taxable: li.taxable ?? true,
    })),
    subtotal: Number(est.subtotal),
    discount: Number(est.discount_amount),
    taxRate: Number(est.tax_rate),
    tax: Number(est.tax_amount),
    total: Number(est.total),
    laborSubtotal: Number(est.labor_subtotal ?? 0),
    materialsSubtotal: Number(est.materials_subtotal ?? 0),
    taxableSubtotal: Number(est.taxable_subtotal ?? est.subtotal ?? 0),
    notes: est.notes,
    terms: est.terms,
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
  const { organizationId, organization, est } = await loadEstimateForDoc(id);
  const cust: any = est.customers;
  if (!cust?.email) throw new Error("Customer has no email.");
  await sendOrgEmail(organizationId, {
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

export async function deleteEstimate(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("estimates").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/estimates");
  redirect("/estimates");
}

export type BulkResult = { ok: number; failed: number; errors: string[] };

export async function bulkDeleteEstimates(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: 0, errors: [] };
  if (!ids.length) return result;
  const { supabase, organizationId } = await getSessionAndOrg();
  const { error, count } = await supabase
    .from("estimates")
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
  revalidatePath("/estimates");
  return result;
}

export async function bulkSaveEstimatesToDrive(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: 0, errors: [] };
  for (const id of ids) {
    try {
      await saveEstimateToDrive(id);
      result.ok++;
    } catch (e) {
      result.failed++;
      result.errors.push(`${id}: ${(e as Error).message}`);
    }
  }
  revalidatePath("/estimates");
  return result;
}

export async function bulkEmailEstimatesToCustomers(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: 0, errors: [] };
  for (const id of ids) {
    try {
      await emailEstimateToCustomer(id);
      result.ok++;
    } catch (e) {
      result.failed++;
      result.errors.push(`${id}: ${(e as Error).message}`);
    }
  }
  revalidatePath("/estimates");
  return result;
}
