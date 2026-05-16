"use server";

import { getSessionAndOrgForMutation as getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";

export async function createGalleryLink(jobId: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: job } = await supabase.from("jobs").select("customer_id, title").eq("id", jobId).single();
  const token = crypto.randomUUID().replace(/-/g, "");
  await supabase.from("public_galleries").insert({
    organization_id: organizationId,
    job_id: jobId,
    customer_id: job?.customer_id ?? null,
    token,
    title: job?.title ?? null,
  });
  revalidatePath(`/jobs/${jobId}`);
}
