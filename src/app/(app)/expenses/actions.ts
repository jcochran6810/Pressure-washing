"use server";

import { getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createExpense(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("expenses").insert({
    organization_id: organizationId,
    vendor: String(formData.get("vendor") || "").trim() || null,
    amount: Number(formData.get("amount") || 0),
    expense_date: String(formData.get("expense_date") || new Date().toISOString().slice(0, 10)),
    category_id: (String(formData.get("category_id") || "") || null) as string | null,
    description: String(formData.get("description") || "").trim() || null,
    payment_method: String(formData.get("payment_method") || "").trim() || null,
    job_id: (String(formData.get("job_id") || "") || null) as string | null,
    tax_deductible: formData.get("tax_deductible") === "on",
    receipt_url: String(formData.get("receipt_url") || "").trim() || null,
  });
  revalidatePath("/expenses");
  redirect("/expenses");
}

export async function createExpenseCategory(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("expense_categories").insert({
    organization_id: organizationId,
    name: String(formData.get("name") || "").trim(),
  });
  revalidatePath("/expenses");
}

export async function deleteExpense(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("expenses").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/expenses");
}
