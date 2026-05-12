import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { setJobStatus, deleteJob } from "../actions";
import { createGalleryLink } from "./gallery-actions";
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

      <div className="card-padded mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Field label="Scheduled start" value={formatDateTime(job.scheduled_start)} />
          <Field label="Scheduled end" value={formatDateTime(job.scheduled_end)} />
          <Field label="Total" value={formatCurrency(Number(job.total_amount))} />
          <Field label="Property" value={(job.properties as any)?.address_line1 ?? "—"} />
        </div>
        {job.description && <p className="text-sm mt-3 whitespace-pre-wrap">{job.description}</p>}
      </div>

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
