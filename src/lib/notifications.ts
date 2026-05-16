import type { SupabaseClient } from "@supabase/supabase-js";

export type NotifyKind =
  | "payment_received" | "invoice_sent" | "invoice_overdue"
  | "estimate_accepted" | "estimate_declined"
  | "job_completed" | "job_scheduled"
  | "lead_new" | "review_received"
  | "contract_run" | "low_stock"
  | "system";

export async function notify(
  supabase: SupabaseClient<any, any, any>,
  opts: {
    organizationId: string;
    userId?: string | null;
    kind: NotifyKind | string;
    title: string;
    body?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    url?: string | null;
  },
) {
  try {
    await supabase.from("notifications").insert({
      organization_id: opts.organizationId,
      user_id: opts.userId ?? null,
      kind: opts.kind,
      title: opts.title,
      body: opts.body ?? null,
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
      url: opts.url ?? null,
    });
  } catch (e) {
    console.error("notify failed", e);
  }
}
