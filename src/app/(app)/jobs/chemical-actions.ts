"use server";

import { getSessionAndOrgForMutation as getSessionAndOrg } from "@/lib/org";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function addChemicalUsage(jobId: string, formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const chemical_id = String(formData.get("chemical_id") || "");
  const quantity = Number(formData.get("quantity") || 0);
  if (!chemical_id || quantity <= 0) return;
  await supabase.from("job_chemical_usage").insert({
    organization_id: organizationId,
    job_id: jobId,
    chemical_id,
    quantity,
  });
  await logAudit({
    organizationId,
    action: "create",
    entityType: "job_chemical_usage",
    entityId: jobId,
    after: { chemical_id, quantity },
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function removeChemicalUsage(usageId: string, jobId: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase
    .from("job_chemical_usage")
    .delete()
    .eq("id", usageId)
    .eq("organization_id", organizationId)
    .eq("applied", false);
  revalidatePath(`/jobs/${jobId}`);
}

// Called when a job moves to "completed". Converts any pending usage rows
// into chemical_transactions and decrements current_stock.
export async function applyJobChemicalUsage(
  supabase: any,
  organizationId: string,
  jobId: string,
) {
  const { data: pending } = await supabase
    .from("job_chemical_usage")
    .select("id, chemical_id, quantity")
    .eq("job_id", jobId)
    .eq("organization_id", organizationId)
    .eq("applied", false);

  if (!pending?.length) return;

  for (const u of pending) {
    const { data: tx } = await supabase
      .from("chemical_transactions")
      .insert({
        organization_id: organizationId,
        chemical_id: u.chemical_id,
        job_id: jobId,
        transaction_type: "usage",
        quantity: u.quantity,
        transaction_date: new Date().toISOString().slice(0, 10),
        notes: `Auto-deducted on job completion`,
      })
      .select("id")
      .single();

    const { data: chem } = await supabase
      .from("chemicals")
      .select("current_stock, name, reorder_level")
      .eq("id", u.chemical_id)
      .single();
    const newStock = Math.max(0, Number(chem?.current_stock ?? 0) - Number(u.quantity));
    await supabase.from("chemicals").update({ current_stock: newStock }).eq("id", u.chemical_id);

    await supabase
      .from("job_chemical_usage")
      .update({ applied: true, applied_at: new Date().toISOString(), transaction_id: tx?.id ?? null })
      .eq("id", u.id);

    // Low-stock notification
    if (chem?.reorder_level && newStock <= Number(chem.reorder_level)) {
      await supabase.from("notifications").insert({
        organization_id: organizationId,
        kind: "low_stock",
        title: "Low chemical stock",
        body: `${chem.name} is at or below reorder level (${newStock.toFixed(2)} remaining)`,
        entity_type: "chemical",
        entity_id: u.chemical_id,
        url: "/chemicals",
      });
    }
  }
}
