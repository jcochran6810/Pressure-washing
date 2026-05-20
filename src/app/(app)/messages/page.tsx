// Operator-facing send log. Lists every outbound email and SMS this org
// has dispatched, with status + provider id + related document. Now also
// renders a per-job workflow checklist at the top so the operator can
// spot what's stalled at a glance — estimate sent but never approved,
// job completed but invoice never sent, paid but receipt missing, etc.

import { getSessionAndOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { formatDate, customerDisplayName } from "@/lib/utils";
import { WorkflowChecklist, type WorkflowRow } from "@/components/workflow-checklist";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const WORKFLOW_LIMIT = 50;

async function loadWorkflowRows(
  supabase: any,
  organizationId: string,
): Promise<WorkflowRow[]> {
  // Pull recent jobs with their linked estimate + customer + invoices in
  // one round-trip. Receipt log is a second query (small table) keyed on
  // the invoice ids we just learned about.
  const { data: jobs } = await supabase
    .from("jobs")
    .select(`
      id, job_number, status, created_at, scheduled_start, actual_end,
      estimate_id, customer_id,
      customers ( id, first_name, last_name, company_name ),
      estimate:estimates!jobs_estimate_id_fkey ( id, created_at, sent_at, accepted_at, estimate_number ),
      invoices ( id, created_at, sent_at, paid_at, invoice_number )
    `)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(WORKFLOW_LIMIT);
  const jobRows = (jobs ?? []) as any[];
  if (!jobRows.length) return [];

  const invoiceIds = jobRows.flatMap((j: any) =>
    ((j.invoices as any[]) ?? []).map((inv) => inv.id as string),
  );

  const { data: receipts } = invoiceIds.length
    ? await supabase
        .from("receipt_log")
        .select("invoice_id, sent_at")
        .eq("organization_id", organizationId)
        .in("invoice_id", invoiceIds)
        .order("sent_at", { ascending: true })
    : { data: [] as { invoice_id: string; sent_at: string }[] };
  // Earliest receipt per invoice = the first one we sent.
  const receiptByInvoice = new Map<string, string>();
  for (const r of (receipts ?? []) as any[]) {
    if (!receiptByInvoice.has(r.invoice_id)) receiptByInvoice.set(r.invoice_id, r.sent_at);
  }

  return jobRows.map((j: any): WorkflowRow => {
    const cust = j.customers as any;
    // Some workflows skip a separate estimate — pick the first invoice as
    // the canonical one if there are multiple (most jobs have exactly one).
    const inv: any = ((j.invoices as any[]) ?? [])[0] ?? null;
    const est: any = j.estimate ?? null;
    return {
      jobId: j.id as string,
      jobNumber: (j.job_number as string | null) ?? est?.estimate_number ?? inv?.invoice_number ?? null,
      customerName: customerDisplayName(cust ?? {}),
      customerHref: cust?.id ? `/customers/${cust.id}` : null,
      estimateId: est?.id ?? null,
      invoiceId: inv?.id ?? null,
      estimateStartedAt: est?.created_at ?? null,
      estimateSentAt: est?.sent_at ?? null,
      estimateApprovedAt: est?.accepted_at ?? null,
      jobScheduledAt: (j.scheduled_start as string | null) ?? (j.created_at as string | null),
      jobCompletedAt: (j.actual_end as string | null) ?? (j.status === "completed" ? j.created_at : null),
      invoiceCreatedAt: inv?.created_at ?? null,
      invoiceSentAt: inv?.sent_at ?? null,
      paidAt: inv?.paid_at ?? null,
      receiptSentAt: inv ? receiptByInvoice.get(inv.id) ?? null : null,
    };
  });
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; status?: string; page?: string }>;
}) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { channel = "all", status = "all", page = "1" } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const workflowRows = await loadWorkflowRows(supabase, organizationId);

  const wantEmail = channel === "all" || channel === "email";
  const wantSms = channel === "all" || channel === "sms";

  let emailQ: any = supabase
    .from("email_log")
    .select("id, to_email, subject, status, error, provider, provider_id, related_kind, related_id, sent_at")
    .eq("organization_id", organizationId)
    .order("sent_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (status !== "all") emailQ = emailQ.eq("status", status);

  let smsQ: any = supabase
    .from("sms_log")
    .select("id, to_phone, body, status, error, provider, provider_id, related_kind, related_id, sent_at")
    .eq("organization_id", organizationId)
    .order("sent_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (status !== "all") smsQ = smsQ.eq("status", status);

  const [{ data: emails }, { data: smses }] = await Promise.all([
    wantEmail ? emailQ : Promise.resolve({ data: [] as any[] }),
    wantSms ? smsQ : Promise.resolve({ data: [] as any[] }),
  ]);

  type Row = {
    id: string;
    kind: "email" | "sms";
    to: string;
    subject: string;
    status: string;
    error: string | null;
    provider: string | null;
    related_kind: string | null;
    related_id: string | null;
    sent_at: string;
  };

  const rows: Row[] = [
    ...(emails ?? []).map((e: any): Row => ({
      id: e.id,
      kind: "email",
      to: e.to_email,
      subject: e.subject ?? "(no subject)",
      status: e.status ?? "sent",
      error: e.error,
      provider: e.provider,
      related_kind: e.related_kind,
      related_id: e.related_id,
      sent_at: e.sent_at,
    })),
    ...(smses ?? []).map((s: any): Row => ({
      id: s.id,
      kind: "sms",
      to: s.to_phone,
      subject: (s.body ?? "").slice(0, 80),
      status: s.status ?? "sent",
      error: s.error,
      provider: s.provider,
      related_kind: s.related_kind,
      related_id: s.related_id,
      sent_at: s.sent_at,
    })),
  ].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()).slice(0, PAGE_SIZE);

  function chip(label: string, key: "channel" | "status", value: string, active: string) {
    const isActive = active === value;
    const params = new URLSearchParams({ channel, status, page: "1" });
    params.set(key, value);
    return (
      <Link
        href={`/messages?${params.toString()}`}
        className={`px-2 py-1 rounded text-xs border ${isActive ? "bg-brand-50 border-brand-300 text-brand-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
      >
        {label}
      </Link>
    );
  }

  function statusBadge(s: string) {
    const cls =
      s === "delivered" || s === "sent" ? "bg-green-100 text-green-700" :
      s === "failed" || s === "bounced" ? "bg-red-100 text-red-700" :
      s === "pending" ? "bg-amber-100 text-amber-700" :
      "bg-gray-100 text-gray-700";
    return <span className={`badge ${cls}`}>{s}</span>;
  }

  function relatedLink(r: Row) {
    if (!r.related_kind || !r.related_id) return null;
    const href =
      r.related_kind === "invoice" ? `/invoices/${r.related_id}` :
      r.related_kind === "estimate" ? `/estimates/${r.related_id}` :
      r.related_kind === "job" ? `/jobs/${r.related_id}` :
      null;
    return href ? <Link href={href} className="text-xs text-brand-700 hover:underline">{r.related_kind} →</Link> : null;
  }

  return (
    <div>
      <PageHeader title="Send log" description="Per-job workflow progress + every email and SMS this org has sent." />

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Job workflow</h2>
        <p className="text-xs text-gray-500 mb-2">
          Each row tracks one job from estimate draft through paid + receipt. Empty
          columns are steps that haven&rsquo;t happened yet — use them to spot stalled
          deals.
        </p>
        <WorkflowChecklist rows={workflowRows} />
      </section>

      <h2 className="text-sm font-semibold text-gray-700 mb-2">Email &amp; SMS log</h2>
      <div className="card-padded mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {chip("All", "channel", "all", channel)}
          {chip("Email", "channel", "email", channel)}
          {chip("SMS", "channel", "sms", channel)}
        </div>
        <div className="flex gap-1">
          {chip("Any status", "status", "all", status)}
          {chip("Sent", "status", "sent", status)}
          {chip("Failed", "status", "failed", status)}
          {chip("Bounced", "status", "bounced", status)}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>To</th>
              <th>Subject / preview</th>
              <th>Status</th>
              <th>Related</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center text-gray-500 py-8">No messages yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={`${r.kind}-${r.id}`}>
                <td className="whitespace-nowrap text-xs text-gray-500">{r.sent_at ? formatDate(r.sent_at) : "—"}</td>
                <td className="text-xs uppercase text-gray-500">{r.kind}</td>
                <td className="text-sm">{r.to}</td>
                <td className="text-sm truncate max-w-[300px]">{r.subject}{r.error ? <div className="text-xs text-red-600">{r.error}</div> : null}</td>
                <td>{statusBadge(r.status)}</td>
                <td>{relatedLink(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
