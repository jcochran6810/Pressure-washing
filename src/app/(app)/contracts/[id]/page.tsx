import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { customerDisplayName, formatCurrency, formatDate, statusColor } from "@/lib/utils";
import { deleteContract, runContractNow, setContractStatus } from "../actions";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: c } = await (supabase as any)
    .from("contracts")
    .select("*, customers(*), properties(*)")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const { data: runs } = await (supabase as any)
    .from("contract_runs")
    .select("id, run_date, status, estimate_id, job_id, error, created_at")
    .eq("contract_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const runNow = runContractNow.bind(null, id);
  const del = deleteContract.bind(null, id);
  const pause = setContractStatus.bind(null, id, "paused");
  const resume = setContractStatus.bind(null, id, "active");
  const cancel = setContractStatus.bind(null, id, "cancelled");

  return (
    <div>
      <Link href="/contracts" className="text-sm text-brand-600 hover:underline">← Contracts</Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mt-2 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{c.name}</h1>
          <p className="text-sm text-gray-600">{customerDisplayName(c.customers)}</p>
          <span className={`badge mt-1 ${statusColor(c.status)}`}>{c.status}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={runNow}><button className="btn-primary">Run now</button></form>
          {c.status === "active" && <form action={pause}><button className="btn-secondary">Pause</button></form>}
          {c.status === "paused" && <form action={resume}><button className="btn-secondary">Resume</button></form>}
          {c.status !== "cancelled" && <form action={cancel}><button className="btn-ghost text-red-600">Cancel</button></form>}
        </div>
      </div>

      <div className="card-padded mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Field label="Cadence" value={`Every ${c.cadence_months} mo`} />
          <Field label="Next run" value={formatDate(c.next_run_date)} />
          <Field label="Start" value={formatDate(c.start_date)} />
          <Field label="Default amount" value={c.default_amount ? formatCurrency(Number(c.default_amount)) : "—"} />
          <Field label="Property" value={c.properties?.nickname || c.properties?.address_line1 || "—"} />
          <Field label="Auto estimate" value={c.auto_create_estimate ? "Yes" : "No"} />
          <Field label="Auto job" value={c.auto_create_job ? "Yes" : "No"} />
          <Field label="Preferred day" value={c.preferred_day ? `${c.preferred_day}` : "—"} />
        </div>
        {c.notes && <p className="text-sm mt-3 whitespace-pre-wrap text-gray-700">{c.notes}</p>}
      </div>

      <div className="card-padded mb-4">
        <h2 className="font-semibold mb-2">Service template</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th>Description</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit price</th>
              <th className="text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(c.service_template) ? c.service_template : []).map((li: any, i: number) => (
              <tr key={i} className="border-t">
                <td className="py-1">{li.description}</td>
                <td className="py-1 text-right">{li.quantity}</td>
                <td className="py-1 text-right">{formatCurrency(Number(li.unit_price))}</td>
                <td className="py-1 text-right font-medium">{formatCurrency(Number(li.quantity) * Number(li.unit_price))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card-padded mb-4">
        <h2 className="font-semibold mb-2">Run history</h2>
        {!runs?.length ? (
          <p className="text-sm text-gray-500">No runs yet — hit "Run now" or wait until the next run date.</p>
        ) : (
          <ul className="text-sm divide-y divide-gray-100">
            {runs.map((r: any) => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                <span>{formatDate(r.run_date)}</span>
                <span className={`badge ${statusColor(r.status)}`}>{r.status}</span>
                <span className="text-gray-500 text-xs flex-1 text-right">
                  {r.estimate_id && <Link href={`/estimates/${r.estimate_id}`} className="text-brand-700 hover:underline mr-2">View estimate</Link>}
                  {r.job_id && <Link href={`/jobs/${r.job_id}`} className="text-brand-700 hover:underline">View job</Link>}
                  {r.error && <span className="text-red-600">{r.error}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={del}><button className="btn-ghost text-red-600 text-xs">Delete contract</button></form>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
