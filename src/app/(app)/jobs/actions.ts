"use server";

import { getSessionAndOrgForMutation as getSessionAndOrg } from "@/lib/org";
import { jobSchema, parseForm } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { applyJobChemicalUsage } from "./chemical-actions";
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
  const { data: before } = await supabase
    .from("jobs")
    .select("title, status")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();

  const patch: any = { status };
  if (status === "in_progress") patch.actual_start = new Date().toISOString();
  if (status === "completed") patch.actual_end = new Date().toISOString();
  await supabase.from("jobs").update(patch).eq("id", id).eq("organization_id", organizationId);

  await logAudit({
    organizationId,
    action: "update",
    entityType: "job",
    entityId: id,
    entityLabel: before?.title ?? null,
    before: { status: before?.status },
    after: { status },
  });

  // When the owner marks a job completed, auto-draft an invoice from the linked
  // estimate (or from the job total) so the next workflow step is one click away.
  if (status === "completed") {
    await applyJobChemicalUsage(supabase as any, organizationId, id);
    await notify(supabase as any, {
      organizationId,
      kind: "job_completed",
      title: `Job completed`,
      body: before?.title ?? null,
      entityType: "job",
      entityId: id,
      url: `/jobs/${id}`,
    });
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
        const invoice_number = await nextInvoiceNumber(supabase, organizationId);
        const due = new Date(); due.setDate(due.getDate() + 14);

        if (job.estimate_id) {
          const { data: est } = await supabase
            .from("estimates")
            .select("*, estimate_line_items(*)")
            .eq("id", job.estimate_id)
            .single();
          if (est) {
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
                })),
              );
            }
          }
        } else {
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
  const { data: org } = await supabase
    .from("organizations")
    .select("next_invoice_number, invoice_prefix")
    .eq("id", organizationId)
    .single();
  const num = org?.next_invoice_number ?? 1000;
  const prefix = org?.invoice_prefix ?? "INV";
  await supabase.from("organizations").update({ next_invoice_number: num + 1 }).eq("id", organizationId);
  return `${prefix}-${num}`;
}

export async function scheduleJob(id: string, formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const start = String(formData.get("scheduled_start") || "");
  const end = String(formData.get("scheduled_end") || "") || null;
  if (!start) throw new Error("Start time required");
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

export async function deleteJob(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("jobs").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/jobs");
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
