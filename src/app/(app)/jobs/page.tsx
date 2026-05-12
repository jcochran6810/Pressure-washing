import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { setJobStatus } from "./actions";
import { customerDisplayName, formatCurrency, formatDateTime, statusColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { status } = await searchParams;

  let query = supabase
    .from("jobs")
    .select("id, title, status, scheduled_start, scheduled_end, total_amount, customers(first_name, last_name, company_name), properties(address_line1, city, state)")
    .eq("organization_id", organizationId)
    .order("scheduled_start", { ascending: true });
  if (status) query = query.eq("status", status);
  const { data } = await query;

  // Group by date for the mobile-friendly schedule view
  const grouped = new Map<string, any[]>();
  (data ?? []).forEach((j: any) => {
    const key = j.scheduled_start ? new Date(j.scheduled_start).toDateString() : "Unscheduled";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(j);
  });

  return (
    <div>
      <PageHeader title="Jobs" description="Scheduled and active work." action={{ label: "New job", href: "/jobs/new" }} />

      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <FilterTab href="/jobs" label="All" active={!status} />
        {["scheduled", "in_progress", "completed", "cancelled"].map((s) => (
          <FilterTab key={s} href={`/jobs?status=${s}`} label={s.replace("_", " ")} active={status === s} />
        ))}
      </div>

      {!data?.length ? (
        <EmptyState title="No jobs yet" action={{ label: "Schedule a job", href: "/jobs/new" }} />
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([day, jobs]) => (
            <div key={day}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">{day}</h2>
              <div className="space-y-2">
                {jobs.map((j) => {
                  const advance = j.status === "scheduled" ? "in_progress" : j.status === "in_progress" ? "completed" : null;
                  const advanceLabel = advance === "in_progress" ? "Start" : advance === "completed" ? "Complete" : null;
                  const action = advance ? setJobStatus.bind(null, j.id, advance) : null;
                  return (
                    <div key={j.id} className="card-padded flex flex-wrap gap-3 items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <Link href={`/jobs/${j.id}`} className="font-semibold hover:text-brand-700">{j.title}</Link>
                        <p className="text-sm text-gray-600">{customerDisplayName(j.customers ?? {})}</p>
                        {j.properties && <p className="text-xs text-gray-500">{j.properties.address_line1}{j.properties.city ? `, ${j.properties.city}` : ""}</p>}
                        <p className="text-xs text-gray-500 mt-1">{formatDateTime(j.scheduled_start)}{j.scheduled_end ? ` → ${formatDateTime(j.scheduled_end)}` : ""}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`badge ${statusColor(j.status)}`}>{j.status.replace("_", " ")}</span>
                        {Number(j.total_amount) > 0 && <span className="text-sm font-medium">{formatCurrency(Number(j.total_amount))}</span>}
                        {action && (
                          <form action={action}>
                            <button className="btn-secondary text-xs py-1 px-2">{advanceLabel}</button>
                          </form>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full capitalize text-sm ${active ? "bg-brand-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}
    >
      {label}
    </Link>
  );
}
