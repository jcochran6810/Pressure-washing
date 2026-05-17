// Self-service data export. Returns a JSON dump of everything in the
// user's organization. Available to authenticated users any time, and
// linked from the pre-deletion warning email.

import { NextResponse } from "next/server";
import { getSessionAndOrg } from "@/lib/org";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABLES = [
  "customers", "properties", "estimates", "estimate_line_items",
  "invoices", "invoice_line_items", "payments",
  "jobs", "job_assignments", "job_chemical_usage",
  "expenses", "expense_categories",
  "chemicals", "chemical_transactions", "chemical_recipes",
  "equipment", "leads", "lead_sources", "campaigns",
  "measurements", "photo_attachments", "photo_annotations",
  "public_galleries", "review_feedback", "receipt_log",
  "contracts", "contract_runs", "waivers", "waiver_signatures",
  "customer_reminders", "message_templates", "sms_log", "audit_log",
];

export async function GET(request: Request) {
  // Rate-limit so a compromised account can't drain the DB on repeat.
  const ip = clientIp(request);
  const rl = rateLimit({ key: `export:${ip}`, limit: 5, windowMs: 60 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many export requests. Try again later." }, { status: 429 });
  }

  const { supabase, organizationId, organization } = await getSessionAndOrg();

  const dump: Record<string, any[]> = {
    organization: [organization],
  };

  for (const t of TABLES) {
    const { data } = await (supabase as any).from(t).select("*").eq("organization_id", organizationId);
    dump[t] = data ?? [];
  }

  const filename = `${(organization?.name || "data").replace(/[^a-z0-9]+/gi, "-")}-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(dump, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
