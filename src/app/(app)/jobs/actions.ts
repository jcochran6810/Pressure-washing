"use server";

import { getSessionAndOrg } from "@/lib/org";
import { jobSchema, parseForm } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createJob(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const data = parseForm(jobSchema, formData);
  const customer_id = data.customer_id;
  const property_id = data.property_id ?? null;
  const title = data.title;
  const description = data.description ?? null;
  const scheduled_start = data.scheduled_start || null;
  const scheduled_end = data.scheduled_end || null;
  const total_amount = data.total_amount ?? 0;
  const status = data.status || "scheduled";

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({ organization_id: organizationId, customer_id, property_id, title, description, scheduled_start, scheduled_end, total_amount, status })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Schedule an appointment reminder using org's lead time
  if (scheduled_start) {
    const { data: org } = await supabase.from("organizations").select("appointment_reminder_hours").eq("id", organizationId).single();
    const hours = org?.appointment_reminder_hours ?? 24;
    const remindAt = new Date(scheduled_start);
    remindAt.setHours(remindAt.getHours() - hours);
    if (remindAt > new Date()) {
      await supabase.from("customer_reminders").insert({
        organization_id: organizationId,
        customer_id,
        job_id: job.id,
        kind: "appointment",
        channel: "email",
        scheduled_for: remindAt.toISOString(),
        message: `Reminder: your appointment is in ${hours} hours.`,
      });
    }
  }

  revalidatePath("/jobs");
  redirect(`/jobs`);
}

export async function setJobStatus(id: string, status: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const patch: any = { status };
  if (status === "in_progress") patch.actual_start = new Date().toISOString();
  if (status === "completed") patch.actual_end = new Date().toISOString();
  await supabase.from("jobs").update(patch).eq("id", id).eq("organization_id", organizationId);

  // When the owner marks a job completed, auto-draft an invoice from the linked
  // estimate (or from the job total) so the next workflow step is one click away.
  if (status === "completed") {
    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("job_id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!existing) {
      const { data: job } = await supabase
        .from("jobs")
        .select("customer_id, estimate_id, total_amount, title")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .single();
      if (job) {
        const due = new Date(); due.setDate(due.getDate() + 14);

        if (job.estimate_id) {
          const { data: est } = await supabase
            .from("estimates")
            .select("*, estimate_line_items(*)")
            .eq("id", job.estimate_id)
            .single();
          if (est) {
            // Reuse the estimate's number end-to-end through the chain.
            const invoice_number = est.estimate_number;
            const { data: inv } = await supabase
              .from("invoices")
              .insert({
                organization_id: organizationId,
                customer_id: job.customer_id,
                job_id: id,
                estimate_id: est.id,
                invoice_number,
                status: "draft",
                issue_date: new Date().toISOString().slice(0, 10),
                due_date: due.toISOString().slice(0, 10),
                subtotal: est.subtotal,
                tax_rate: est.tax_rate,
                tax_amount: est.tax_amount,
                discount_amount: est.discount_amount,
                total: est.total,
                balance_due: est.total,
                notes: est.notes,
                terms: est.terms,
              })
              .select("id")
              .single();
            if (inv && est.estimate_line_items?.length) {
              await supabase.from("invoice_line_items").insert(
                est.estimate_line_items.map((li: any) => ({
                  invoice_id: inv.id,
                  description: li.description,
                  quantity: li.quantity,
                  unit_price: li.unit_price,
                  total: li.total,
                  sort_order: li.sort_order,
                  photo_urls: li.photo_urls ?? [],
                  materials_description: li.materials_description ?? null,
                  materials_cost: li.materials_cost ?? 0,
                })),
              );
            }
          }
        } else {
          // Standalone job (no estimate parent) — allocate a fresh number.
          const invoice_number = await nextInvoiceNumber(supabase, organizationId);
          const amount = Number(job.total_amount ?? 0);
          const { data: inv } = await supabase
            .from("invoices")
            .insert({
              organization_id: organizationId,
              customer_id: job.customer_id,
              job_id: id,
              invoice_number,
              status: "draft",
              issue_date: new Date().toISOString().slice(0, 10),
              due_date: due.toISOString().slice(0, 10),
              subtotal: amount,
              total: amount,
              balance_due: amount,
            })
            .select("id")
            .single();
          if (inv && amount > 0) {
            await supabase.from("invoice_line_items").insert([{
              invoice_id: inv.id,
              description: job.title,
              quantity: 1,
              unit_price: amount,
              total: amount,
              sort_order: 0,
            }]);
          }
        }
      }
    }
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/invoices");
}

async function nextInvoiceNumber(supabase: any, organizationId: string) {
  const { nextDocumentNumber } = await import("@/lib/numbering");
  return nextDocumentNumber(supabase, organizationId);
}

export type DaySchedule = {
  events: { id: string; summary: string; start: string; end: string; allDay: boolean; htmlLink?: string }[];
  calendarName: string | null;
  connected: boolean;
};

export async function listGoogleEventsForDay(dateIso: string): Promise<DaySchedule> {
  const { organizationId } = await getSessionAndOrg();
  const { getCalendarAccessToken, listEvents } = await import("@/lib/google-calendar");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return { events: [], calendarName: null, connected: false };
  }

  const conn = await getCalendarAccessToken(organizationId);
  if (!conn?.conn?.calendar_id) {
    return { events: [], calendarName: null, connected: false };
  }

  const [y, m, d] = dateIso.split("-").map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

  try {
    const events = await listEvents({
      access_token: conn.token,
      calendar_id: conn.conn.calendar_id,
      timeMin: dayStart,
      timeMax: dayEnd,
    });
    return {
      connected: true,
      calendarName: conn.conn.calendar_name ?? conn.conn.calendar_id,
      events: events
        .map((e) => ({
          id: e.id,
          summary: e.summary || "Untitled",
          start: (e.start.dateTime ?? e.start.date) ?? "",
          end: (e.end.dateTime ?? e.end.date) ?? "",
          allDay: !e.start.dateTime,
          htmlLink: e.htmlLink,
        }))
        .sort((a, b) => a.start.localeCompare(b.start)),
    };
  } catch (e) {
    return { events: [], calendarName: conn.conn.calendar_name ?? null, connected: true };
  }
}

export async function scheduleJob(id: string, formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const start = String(formData.get("scheduled_start") || "");
  const end = String(formData.get("scheduled_end") || "") || null;
  if (!start) throw new Error("Start time required");
  // datetime-local strings carry no timezone — interpret them in the user's
  // local clock, then reject anything before "now" so a typo can't book a
  // job in the past. (The client-side check is a hint; this is the real gate.)
  const startMs = new Date(start).getTime();
  if (Number.isFinite(startMs) && startMs < Date.now() - 60_000) {
    throw new Error("That start time has already passed.");
  }
  await supabase
    .from("jobs")
    .update({ scheduled_start: start, scheduled_end: end })
    .eq("id", id)
    .eq("organization_id", organizationId);

  // Schedule the appointment reminder for the new time
  const { data: job } = await supabase.from("jobs").select("customer_id").eq("id", id).single();
  if (job) {
    const { data: org } = await supabase
      .from("organizations")
      .select("appointment_reminder_hours")
      .eq("id", organizationId)
      .single();
    const hours = org?.appointment_reminder_hours ?? 24;
    const remindAt = new Date(start);
    remindAt.setHours(remindAt.getHours() - hours);
    if (remindAt > new Date()) {
      // Remove any existing scheduled appointment reminders for this job, then add the new one
      await supabase
        .from("customer_reminders")
        .delete()
        .eq("job_id", id)
        .eq("kind", "appointment")
        .eq("status", "scheduled");
      await supabase.from("customer_reminders").insert({
        organization_id: organizationId,
        customer_id: job.customer_id,
        job_id: id,
        kind: "appointment",
        channel: "email",
        scheduled_for: remindAt.toISOString(),
        message: `Reminder: your appointment is in ${hours} hours.`,
      });
    }
  }

  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  revalidatePath("/calendar");
}

// One-click "start the job right now" path: used by the workflow banner on
// estimates that were accepted and the crew started immediately. Sets
// scheduled_start = now, marks the job in_progress, and skips reminders
// (there's no future event to remind about).
export async function scheduleJobImmediately(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const now = new Date();
  await supabase
    .from("jobs")
    .update({
      scheduled_start: now.toISOString(),
      status: "in_progress",
      actual_start: now.toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId);

  // Wipe any reminder that was queued before "immediate" was chosen.
  await (supabase as any)
    .from("customer_reminders")
    .delete()
    .eq("job_id", id)
    .eq("kind", "appointment")
    .eq("status", "scheduled");

  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
  revalidatePath("/calendar");
}

export async function deleteJob(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("jobs").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/jobs");
}

export type BulkResult = { ok: number; failed: number; errors: string[] };

export async function bulkDeleteJobs(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: 0, errors: [] };
  if (!ids.length) return result;
  const { supabase, organizationId } = await getSessionAndOrg();
  const { error, count } = await supabase
    .from("jobs")
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
  revalidatePath("/jobs");
  revalidatePath("/calendar");
  return result;
}

export async function bulkSetJobStatus(ids: string[], status: string): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: 0, errors: [] };
  for (const id of ids) {
    try {
      await setJobStatus(id, status);
      result.ok++;
    } catch (e) {
      result.failed++;
      result.errors.push(`${id}: ${(e as Error).message}`);
    }
  }
  return result;
}

export const bulkMarkJobsCompleted = (ids: string[]) => bulkSetJobStatus(ids, "completed");
export const bulkMarkJobsInProgress = (ids: string[]) => bulkSetJobStatus(ids, "in_progress");
export const bulkMarkJobsScheduled = (ids: string[]) => bulkSetJobStatus(ids, "scheduled");
export const bulkCancelJobs = (ids: string[]) => bulkSetJobStatus(ids, "cancelled");

export async function bulkSendJobReminders(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { ok: 0, failed: 0, errors: [] };
  if (!ids.length) return result;
  const { sendTemplated } = await import("@/lib/messaging");
  const { supabase, organizationId, organization } = await getSessionAndOrg();

  for (const id of ids) {
    try {
      const { data: job } = await supabase
        .from("jobs")
        .select("id, title, scheduled_start, customers(first_name, last_name, company_name, email, phone, mobile_phone), properties(address_line1, city, state)")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .single();
      if (!job) throw new Error("Job not found");
      const cust: any = job.customers;
      const prop: any = job.properties;
      if (!cust?.email) throw new Error("Customer has no email");
      const send = await sendTemplated({
        supabase: supabase as any,
        organizationId,
        customerId: null,
        kind: "appointment_reminder",
        channel: "email",
        to: { email: cust?.email, phone: cust?.phone || cust?.mobile_phone },
        replyToEmail: organization?.email,
        relatedKind: "job",
        relatedId: id,
        vars: {
          org_name: organization?.name ?? "",
          org_phone: organization?.phone ?? "",
          customer_first_name: cust?.first_name ?? cust?.company_name ?? "there",
          scheduled_start: job.scheduled_start
            ? new Date(job.scheduled_start).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "TBD",
          property_address: prop
            ? `${prop.address_line1}${prop.city ? `, ${prop.city}` : ""}${prop.state ? `, ${prop.state}` : ""}`
            : "",
        },
      });
      if (!send.ok) throw new Error(send.reason);
      result.ok++;
    } catch (e) {
      result.failed++;
      result.errors.push(`${id}: ${(e as Error).message}`);
    }
  }
  revalidatePath("/jobs");
  return result;
}

// Used by the drag-and-drop calendar to move a job's scheduled day while preserving
// the time-of-day. If the job had no scheduled_start we default to 9am local.
export async function moveJobToDate(jobId: string, isoDate: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error("Invalid date");

  const { data: job } = await supabase
    .from("jobs")
    .select("scheduled_start, scheduled_end, customer_id")
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .single();
  if (!job) throw new Error("Job not found");

  const [y, m, d] = isoDate.split("-").map(Number);
  const targetDay = new Date(y, m - 1, d);
  let newStart: Date;
  let newEnd: Date | null = null;
  const prevStart = job.scheduled_start ? new Date(job.scheduled_start) : null;

  if (prevStart) {
    newStart = new Date(prevStart);
    newStart.setFullYear(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate());
    if (job.scheduled_end) {
      const prevEnd = new Date(job.scheduled_end);
      const deltaMs = prevEnd.getTime() - prevStart.getTime();
      newEnd = new Date(newStart.getTime() + deltaMs);
    }
  } else {
    newStart = new Date(targetDay);
    newStart.setHours(9, 0, 0, 0);
  }

  await supabase
    .from("jobs")
    .update({
      scheduled_start: newStart.toISOString(),
      scheduled_end: newEnd ? newEnd.toISOString() : null,
    })
    .eq("id", jobId)
    .eq("organization_id", organizationId);

  // Refresh the appointment reminder
  await (supabase as any)
    .from("customer_reminders")
    .delete()
    .eq("job_id", jobId)
    .eq("kind", "appointment")
    .eq("status", "scheduled");
  const { data: org } = await supabase
    .from("organizations")
    .select("appointment_reminder_hours")
    .eq("id", organizationId)
    .single();
  const hours = (org as any)?.appointment_reminder_hours ?? 24;
  const remindAt = new Date(newStart);
  remindAt.setHours(remindAt.getHours() - hours);
  if (remindAt > new Date()) {
    await (supabase as any).from("customer_reminders").insert({
      organization_id: organizationId,
      customer_id: job.customer_id,
      job_id: jobId,
      kind: "appointment",
      channel: "email",
      scheduled_for: remindAt.toISOString(),
      message: `Reminder: your appointment is in ${hours} hours.`,
    });
  }

  revalidatePath("/calendar");
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
}
