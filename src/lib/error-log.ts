// Best-effort error logger — writes to public.app_errors so the platform
// admin dashboard can surface issues. Never throws; if logging itself fails
// we just swallow the error to avoid masking the original problem.
//
// Usage from any server action / API route:
//   try { ... } catch (e) { await logAppError(e, { route: "estimates/send", organizationId, userId }); throw e; }

import { createClient } from "@/lib/supabase/server";

type Severity = "warn" | "error" | "fatal";

export async function logAppError(
  err: unknown,
  context: {
    route?: string;
    organizationId?: string | null;
    userId?: string | null;
    severity?: Severity;
    extra?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const supabase = await createClient();
    const e = err as any;
    const message = e?.message ?? String(err);
    const stack = e?.stack ?? null;
    await supabase.from("app_errors").insert({
      organization_id: context.organizationId ?? null,
      user_id: context.userId ?? null,
      route: context.route ?? null,
      message: String(message).slice(0, 2000),
      stack: stack ? String(stack).slice(0, 8000) : null,
      severity: context.severity ?? "error",
      context: context.extra ?? null,
    } as any);
  } catch {
    // Intentional — never let the logger fail loudly.
  }
}
