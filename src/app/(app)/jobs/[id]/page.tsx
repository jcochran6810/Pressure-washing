import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { setJobStatus, deleteJob } from "../actions";
import { addChemicalUsage, removeChemicalUsage } from "../chemical-actions";
import { createGalleryLink } from "./gallery-actions";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { NextStepBanner } from "@/components/next-step-banner";
import { loadWorkflow } from "@/lib/workflow";
import { PhotoUploader } from "@/components/photo-uploader";
import { PhotoGallery } from "@/components/photo-gallery";
import { customerDisplayName, formatCurrency, formatDateTime, statusColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: job } = await supabase
    .from("jobs")
    .select("*, customers(*), properties(*)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!job) notFound();

  const { data: photos } = await supabase
    .from("photo_attachments")
    .select("*")
    .eq("job_id", id)
    .order("created_at", { ascending: false });

  const { data: galleries } = await supabase
    .from("public_galleries")
    .select("token, title, created_at")
    .eq("job_id", id)
    .order("created_at", { ascending: false });

  const [{ data: usage }, { data: chemicals }] = await Promise.all([
    supabase
      .from("job_chemical_usage")
      .select("id, quantity, applied, applied_at, chemical_id, chemicals(name, unit)")
      .eq("job_id", id)
      .order("created_at"),
    supabase
      .from("chemicals")
      .select("id, name, unit, current_stock")
      .eq("organization_id", organizationId)
      .order("name"),
  ]);

  const workflow = await loadWorkflow({ jobId: id });

  const advance = job.status === "scheduled" ? "in_progress" : job.status === "in_progress" ? "completed" : null;
  const advanceAction = advance ? setJobStatus.bind(null, id, advance) : null;
  const del = deleteJob.bind(null, id);
  const makeGallery = createGalleryLink.bind(null, id);

  return (
    <div>
      <Link href="/jobs" className="text-sm text-brand-600 hover:underline">← Jobs</Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mt-2 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{job.title}</h1>
          <p className="text-sm text-gray-600">{customerDisplayName(job.customers as any)}</p>
          <span className={`badge mt-1 ${statusColor(job.status)}`}>{job.status.replace("_", " ")}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {advanceAction && (
            <form action={advanceAction}>
              <button className="btn-primary">{advance === "in_progress" ? "Start" : "Complete"}</button>
            </form>
          )}
        </div>
      </div>

      <WorkflowStepper workflow={workflow} />
      <NextStepBanner
        workflow={workflow}
        customerHasEmail={!!(job.customers as any)?.email}
      />

      <div className="card-padded mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Field label="Scheduled start" value={formatDateTime(job.scheduled_start)} />
          <Field label="Scheduled end" value={formatDateTime(job.scheduled_end)} />
          <Field label="Total" value={formatCurrency(Number(job.total_amount))} />
          <Field label="Property" value={(job.properties as any)?.address_line1 ?? "—"} />
        </div>
        {job.description && <p className="text-sm mt-3 whitespace-pre-wrap">{job.description}</p>}
      </div>

      <section className="card-padded mb-4">
        <h2 className="font-semibold mb-3">Chemical usage</h2>
        <p className="text-xs text-gray-500 mb-3">
          Log chemicals used on this job. When the job is marked completed, these are deducted from inventory automatically.
        </p>
        {!!usage?.length && (
          <ul className="divide-y divide-gray-100 mb-3">
            {usage.map((u: any) => (
              <li key={u.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{u.chemicals?.name}</p>
                  <p className="text-xs text-gray-500">{u.quantity} {u.chemicals?.unit ?? "units"}{u.applied ? " · deducted" : " · pending"}</p>
                </div>
                {!u.applied && (
                  <form action={removeChemicalUsage.bind(null, u.id, id)}>
                    <button className="btn-ghost text-red-600 text-xs">Remove</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {chemicals?.length ? (
          <form action={addChemicalUsage.bind(null, id)} className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[180px]">
              <label>Chemical</label>
              <select name="chemical_id" required className="w-full">
                {chemicals.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({Number(c.current_stock ?? 0).toFixed(2)} {c.unit ?? ""} on hand)
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label>Qty</label>
              <input name="quantity" type="number" step="0.01" min="0.01" required className="w-full" />
            </div>
            <button className="btn-secondary text-sm">Add</button>
          </form>
        ) : (
          <p className="text-sm text-gray-500">No chemicals defined yet. <Link href="/chemicals" className="text-brand-600 underline">Add some</Link>.</p>
        )}
      </section>

      <section className="card-padded">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold">Job photos</h2>
          <form action={makeGallery}><button className="btn-secondary text-xs">+ Generate before/after gallery link</button></form>
        </div>
        {galleries?.length ? (
          <ul className="text-xs mb-3 space-y-1">
            {galleries.map((g) => (
              <li key={g.token} className="p-2 bg-brand-50 rounded">
                <a href={`/gallery/${g.token}`} target="_blank" rel="noopener" className="text-brand-700 underline break-all">
                  {process.env.NEXT_PUBLIC_APP_URL || ""}/gallery/{g.token}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <PhotoUploader
          organizationId={job.organization_id}
          targetType="job"
          targetId={job.id}
          customerId={job.customer_id}
          kind={job.status === "completed" ? "after" : "before"}
        />
        <div className="mt-3">
          <PhotoGallery photos={photos ?? []} />
        </div>
      </section>

      <form action={del} className="mt-5">
        <button className="btn-ghost text-red-600 hover:bg-red-50 text-xs">Delete job</button>
      </form>
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
