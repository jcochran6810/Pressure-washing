"use server";

import { getSessionAndOrgForMutation as getSessionAndOrg } from "@/lib/org";
import { contractSchema, parseForm } from "@/lib/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

type ServiceLine = { description: string; quantity: number; unit_price: number };

function parseServiceTemplate(formData: FormData): ServiceLine[] {
  const descs = formData.getAll("svc_description") as string[];
  const qtys = formData.getAll("svc_quantity") as string[];
  const prices = formData.getAll("svc_unit_price") as string[];
  const out: ServiceLine[] = [];
  for (let i = 0; i < descs.length; i++) {
    const d = (descs[i] || "").trim();
    if (!d) continue;
    out.push({
      description: d,
      quantity: Number(qtys[i] || 1),
      unit_price: Number(prices[i] || 0),
    });
  }
  return out;
}

export async function createContract(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const v = parseForm(contractSchema, formData);
  const service_template = parseServiceTemplate(formData);
  const preferred_day = Number(formData.get("preferred_day") || 0) || null;
  const auto_create_estimate = formData.get("auto_create_estimate") === "on";
  const auto_create_job = formData.get("auto_create_job") === "on";

  const startDate = v.start_date || new Date().toISOString().slice(0, 10);

  const { data: contract, error } = await (supabase as any)
    .from("contracts")
    .insert({
      organization_id: organizationId,
      customer_id: v.customer_id,
      property_id: v.property_id ?? null,
      name: v.name,
      cadence_months: v.cadence_months,
      preferred_day,
      start_date: startDate,
      next_run_date: startDate,
      default_amount: v.default_amount ?? null,
      service_template,
      auto_create_estimate,
      auto_create_job,
      notes: v.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/contracts");
  redirect(`/contracts/${contract.id}`);
}

export async function setContractStatus(id: string, status: "active" | "paused" | "cancelled") {
  const { supabase, organizationId } = await getSessionAndOrg();
  await (supabase as any)
    .from("contracts")
    .update({ status })
    .eq("id", id)
    .eq("organization_id", organizationId);
  revalidatePath(`/contracts/${id}`);
  revalidatePath("/contracts");
}

export async function deleteContract(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await (supabase as any).from("contracts").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/contracts");
  redirect("/contracts");
}

// Run the contract NOW (create the next estimate/job and advance next_run_date).
// Also exposed via /api/cron/contracts.
export async function runContractNow(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await runDueContracts(supabase, organizationId, id);
  revalidatePath(`/contracts/${id}`);
}

export async function runDueContracts(
  supabase: any,
  organizationId: string,
  onlyContractId?: string,
): Promise<{ processed: number; errors: string[] }> {
  const today = new Date().toISOString().slice(0, 10);
  const q = supabase
    .from("contracts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .lte("next_run_date", today);
  if (onlyContractId) q.eq("id", onlyContractId);
  const { data: contracts } = await q;

  let processed = 0;
  const errors: string[] = [];

  const { data: org } = await supabase
    .from("organizations")
    .select("next_estimate_number, estimate_prefix, currency")
    .eq("id", organizationId)
    .single();

  let nextEstNum = org?.next_estimate_number ?? 1000;
  const estPrefix = org?.estimate_prefix ?? "EST";

  for (const c of contracts ?? []) {
    try {
      const items: ServiceLine[] = Array.isArray(c.service_template) ? c.service_template : [];
      const subtotal = items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
      const total = c.default_amount != null && Number(c.default_amount) > 0 ? Number(c.default_amount) : subtotal;

      let estimateId: string | null = null;
      let jobId: string | null = null;

      if (c.auto_create_estimate) {
        const estimate_number = `${estPrefix}-${nextEstNum}`;
        nextEstNum += 1;
        const approval_token = crypto.randomUUID().replace(/-/g, "");
        const expires = new Date(c.next_run_date);
        expires.setDate(expires.getDate() + 30);

        const { data: est, error: estErr } = await supabase
          .from("estimates")
          .insert({
            organization_id: organizationId,
            customer_id: c.customer_id,
            property_id: c.property_id,
            estimate_number,
            status: "draft",
            issue_date: c.next_run_date,
            expires_at: expires.toISOString().slice(0, 10),
            subtotal,
            total,
            notes: c.notes,
            approval_token,
          })
          .select("id")
          .single();
        if (estErr) throw new Error(estErr.message);
        estimateId = est?.id ?? null;
        if (estimateId && items.length) {
          await supabase.from("estimate_line_items").insert(
            items.map((li, idx) => ({
              estimate_id: estimateId,
              description: li.description,
              quantity: li.quantity,
              unit_price: li.unit_price,
              total: li.quantity * li.unit_price,
              sort_order: idx,
            })),
          );
        }
      }

      if (c.auto_create_job) {
        const startAt = new Date(c.next_run_date);
        startAt.setHours(9, 0, 0, 0);
        const { data: job } = await supabase
          .from("jobs")
          .insert({
            organization_id: organizationId,
            customer_id: c.customer_id,
            property_id: c.property_id,
            estimate_id: estimateId,
            title: c.name,
            description: c.notes,
            status: "scheduled",
            scheduled_start: startAt.toISOString(),
            total_amount: total,
          })
          .select("id")
          .single();
        jobId = job?.id ?? null;
      }

      const nextRun = advanceMonths(c.next_run_date, c.cadence_months, c.preferred_day);
      const update: any = { next_run_date: nextRun };
      if (c.end_date && nextRun > c.end_date) update.status = "expired";

      await supabase.from("contracts").update(update).eq("id", c.id);
      await supabase.from("contract_runs").insert({
        organization_id: organizationId,
        contract_id: c.id,
        run_date: c.next_run_date,
        estimate_id: estimateId,
        job_id: jobId,
        status: "created",
      });
      processed += 1;
    } catch (e) {
      errors.push(`${c.id}: ${(e as Error).message}`);
      await supabase.from("contract_runs").insert({
        organization_id: organizationId,
        contract_id: c.id,
        run_date: c.next_run_date,
        status: "failed",
        error: (e as Error).message,
      });
    }
  }

  if (processed > 0) {
    await supabase
      .from("organizations")
      .update({ next_estimate_number: nextEstNum })
      .eq("id", organizationId);
  }
  return { processed, errors };
}

function advanceMonths(fromIsoDate: string, months: number, preferredDay: number | null): string {
  const d = new Date(fromIsoDate + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  if (preferredDay && preferredDay >= 1 && preferredDay <= 28) {
    d.setDate(preferredDay);
  }
  return d.toISOString().slice(0, 10);
}
