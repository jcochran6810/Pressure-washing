"use server";

import { getSessionAndOrg } from "@/lib/org";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function disconnectStripeConnect() {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("organizations").update({
    stripe_connect_account_id: null,
    stripe_connect_status: null,
    stripe_connect_connected_at: null,
  }).eq("id", organizationId);
  await logAudit({
    organizationId,
    action: "disconnect",
    entityType: "integration",
    entityLabel: "Stripe Connect",
  });
  revalidatePath("/settings");
}
