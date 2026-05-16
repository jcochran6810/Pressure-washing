import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export type AuditAction =
  | "create" | "update" | "delete"
  | "send" | "pay" | "void"
  | "connect" | "disconnect"
  | "sign_in" | "sign_out";

export async function logAudit(opts: {
  organizationId: string;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const h = await headers();
    await supabase.from("audit_log").insert({
      organization_id: opts.organizationId,
      actor_user_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      action: opts.action,
      entity_type: opts.entityType,
      entity_id: opts.entityId ?? null,
      entity_label: opts.entityLabel ?? null,
      before_data: opts.before ? (opts.before as any) : null,
      after_data: opts.after ? (opts.after as any) : null,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: h.get("user-agent") ?? null,
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
