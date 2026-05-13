import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { customerDisplayName, formatCurrency, formatDate, statusColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomerHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await getSessionAndOrg();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .single();
  if (!customer) notFound();

  const [{ data: properties }, { data: jobs }, { data: invoices }, { data: estimates }, { data: payments }, { data: waivers }, { data: photos }] = await Promise.all([
    supabase.from("properties").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
    (supabase as any)
      .from("jobs")
      .select("id, title, status, scheduled_start, scheduled_end, actual_start, actual_end, total_amount, property_id, properties(address_line1, nickname)")
      .eq("organization_id", organizationId)
      .eq("customer_id", id)
      .order("scheduled_start", { ascending: false }),
    (supabase as any)
      .from("invoices")
      .select("id, invoice_number, status, total, amount_paid, balance_due, issue_date, due_date, paid_at")
      .eq("organization_id", organizationId)
      .eq("customer_id", id)
      .order("issue_date", { ascending: false }),
    (supabase as any)
      .from("estimates")
      .select("id, estimate_number, status, total, issue_date, accepted_at")
      .eq("organization_id", organizationId)
      .eq("customer_id", id)
      .order("issue_date", { ascending: false }),
    (supabase as any)
      .from("payments")
      .select("id, amount, payment_date, payment_method, reference_number, invoices(invoice_number)")
      .eq("organization_id", organizationId)
      .eq("customer_id", id)
      .order("payment_date", { ascending: false }),
    (supabase as any)
      .from("waiver_signatures")
      .select("id, status, signed_at, signer_name, waivers(name)")
      .eq("organization_id", organizationId)
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    (supabase as any)
      .from("photo_attachments")
      .select("id, kind, url, annotated_url, created_at, job_id, property_id")
      .eq("organization_id", organizationId)
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  const totalSpent = (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const totalInvoiced = (invoices ?? []).reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);
  const outstanding = (invoices ?? []).reduce((s: number, i: any) => s + Number(i.balance_due ?? 0), 0);
  const completedJobs = (jobs ?? []).filter((j: any) => j.status === "completed").length;

  const jobsByProperty: Record<string, any[]> = {};
  for (const j of jobs ?? []) {
    const key = j.property_id || "_unassigned";
    if (!jobsByProperty[key]) jobsByProperty[key] = [];
    jobsByProperty[key].push(j);
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm mb-2">
        <Link href={`/customers/${id}`} className="text-brand-600 hover:underline">← {customerDisplayName(customer)}</Link>
        <span className="text-gray-400">/</span>
        <span>Service history</span>
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold mb-1">Service history</h1>
      <p className="text-sm text-gray-600 mb-5">
        Every job, invoice, payment, photo, and waiver for {customerDisplayName(customer)}.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Completed jobs" value={String(completedJobs)} />
        <Stat label="Lifetime invoiced" value={formatCurrency(totalInvoiced)} />
        <Stat label="Lifetime paid" value={formatCurrency(totalSpent)} tone="ok" />
        <Stat label="Outstanding" value={formatCurrency(outstanding)} tone={outstanding > 0 ? "warn" : undefined} />
      </div>

      <h2 className="font-semibold mb-2">By property</h2>
      <div className="space-y-3 mb-6">
        {(properties ?? []).map((p: any) => {
          const list = jobsByProperty[p.id] ?? [];
          return (
            <section key={p.id} className="card">
              <header className="px-4 py-3 border-b flex justify-between gap-3">
                <div>
                  <p className="font-semibold">{p.nickname || p.address_line1}</p>
                  <p className="text-xs text-gray-500">
                    {p.address_line1}{p.city ? `, ${p.city}` : ""}{p.state ? `, ${p.state}` : ""} {p.postal_code ?? ""}
                  </p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p>{list.length} job{list.length === 1 ? "" : "s"}</p>
                  {list[0]?.actual_end && <p>Last service: {formatDate(list[0].actual_end)}</p>}
                </div>
              </header>
              {!list.length ? (
                <p className="px-4 py-3 text-sm text-gray-500">No jobs yet at this address.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {list.map((j: any) => (
                    <li key={j.id} className="px-4 py-2 text-sm flex justify-between items-center gap-3">
                      <Link href={`/jobs/${j.id}`} className="font-medium text-brand-700 hover:underline truncate">{j.title}</Link>
                      <span className="text-gray-500">{formatDate(j.scheduled_start ?? j.actual_end)}</span>
                      <span className={`badge ${statusColor(j.status)}`}>{j.status?.replace("_", " ")}</span>
                      <span className="font-medium">{formatCurrency(Number(j.total_amount))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        {jobsByProperty["_unassigned"]?.length ? (
          <section className="card">
            <header className="px-4 py-3 border-b font-semibold">Jobs without a property</header>
            <ul className="divide-y divide-gray-100">
              {jobsByProperty["_unassigned"].map((j: any) => (
                <li key={j.id} className="px-4 py-2 text-sm flex justify-between items-center gap-3">
                  <Link href={`/jobs/${j.id}`} className="font-medium text-brand-700 hover:underline">{j.title}</Link>
                  <span className="text-gray-500">{formatDate(j.scheduled_start)}</span>
                  <span className={`badge ${statusColor(j.status)}`}>{j.status?.replace("_", " ")}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <h2 className="font-semibold mb-2">Estimates</h2>
      <ListCard rows={estimates ?? []} renderRow={(e: any) => (
        <li key={e.id} className="px-4 py-2 text-sm flex justify-between items-center gap-3">
          <Link href={`/estimates/${e.id}`} className="font-medium text-brand-700 hover:underline">{e.estimate_number}</Link>
          <span className="text-gray-500">{formatDate(e.issue_date)}</span>
          <span className={`badge ${statusColor(e.status)}`}>{e.status}</span>
          <span className="font-medium">{formatCurrency(Number(e.total))}</span>
        </li>
      )} empty="No estimates yet." />

      <h2 className="font-semibold mt-5 mb-2">Invoices</h2>
      <ListCard rows={invoices ?? []} renderRow={(i: any) => (
        <li key={i.id} className="px-4 py-2 text-sm flex justify-between items-center gap-3">
          <Link href={`/invoices/${i.id}`} className="font-medium text-brand-700 hover:underline">{i.invoice_number}</Link>
          <span className="text-gray-500">{formatDate(i.issue_date)}</span>
          <span className={`badge ${statusColor(i.status)}`}>{i.status}</span>
          <span className="font-medium">{formatCurrency(Number(i.balance_due))}</span>
        </li>
      )} empty="No invoices yet." />

      <h2 className="font-semibold mt-5 mb-2">Payments</h2>
      <ListCard rows={payments ?? []} renderRow={(p: any) => (
        <li key={p.id} className="px-4 py-2 text-sm flex justify-between items-center gap-3">
          <span>{formatDate(p.payment_date)}</span>
          <span className="capitalize">{p.payment_method}</span>
          <span className="text-gray-500 truncate">{p.invoices?.invoice_number ?? p.reference_number ?? ""}</span>
          <span className="font-medium">{formatCurrency(Number(p.amount))}</span>
        </li>
      )} empty="No payments recorded yet." />

      <h2 className="font-semibold mt-5 mb-2">Waivers signed</h2>
      <ListCard rows={waivers ?? []} renderRow={(w: any) => (
        <li key={w.id} className="px-4 py-2 text-sm flex justify-between items-center gap-3">
          <span className="font-medium">{w.waivers?.name ?? "Waiver"}</span>
          <span className="text-gray-500">{w.signer_name}</span>
          <span className={`badge ${statusColor(w.status)}`}>{w.status}</span>
          <span className="text-gray-500">{w.signed_at ? formatDate(w.signed_at) : "—"}</span>
        </li>
      )} empty="No signed waivers yet." />

      <h2 className="font-semibold mt-5 mb-2">Photos (recent 24)</h2>
      {!photos?.length ? (
        <p className="text-sm text-gray-500">No photos yet.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {photos.map((p: any) => (
            <a key={p.id} href={p.annotated_url || p.url} target="_blank" rel="noopener" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.annotated_url || p.url}
                alt={p.kind}
                className="w-full aspect-square object-cover rounded border"
              />
              <p className="text-[10px] text-gray-500 mt-0.5 capitalize">{p.kind}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="card-padded">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold ${tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-green-700" : ""}`}>{value}</p>
    </div>
  );
}

function ListCard({ rows, renderRow, empty }: { rows: any[]; renderRow: (r: any) => React.ReactNode; empty: string }) {
  if (!rows.length) return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <div className="card">
      <ul className="divide-y divide-gray-100">{rows.map(renderRow)}</ul>
    </div>
  );
}
