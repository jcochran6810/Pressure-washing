"use server";

import { getSessionAndOrg } from "@/lib/org";
import { nextDocumentNumber } from "@/lib/document-number";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createJob(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const customer_id = String(formData.get("customer_id") || "");
  if (!customer_id) throw new Error("Customer required");

  const property_id = (String(formData.get("property_id") || "") || null) as string | null;
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const scheduled_start = String(formData.get("scheduled_start") || "") || null;
  const scheduled_end = String(formData.get("scheduled_end") || "") || null;
  const total_amount = Number(formData.get("total_amount") || 0);
  const status = String(formData.get("status") || "scheduled");

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
        .select("customer_id, estimate_id, total_amount, title, job_number")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .single();
      if (job) {
        // Inherit the existing document number from the estimate (preferred) or
        // the job itself; only mint a fresh one for standalone jobs.
        let invoice_number: string | null = null;
        if (job.estimate_id) {
          const { data: estForNumber } = await supabase
            .from("estimates")
            .select("estimate_number")
            .eq("id", job.estimate_id)
            .single();
          invoice_number = estForNumber?.estimate_number ?? null;
        }
        if (!invoice_number) invoice_number = job.job_number ?? null;
        if (!invoice_number) invoice_number = await nextDocumentNumber(supabase, organizationId);
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

        // The invoice intentionally stays in draft so the owner can review
        // and edit line items / notes / photos on the invoice detail page
        // before clicking "Send invoice to customer".
      }
    }
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/invoices");
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
