import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { JobsList, type JobRow } from "./jobs-list";

export const dynamic = "force-dynamic";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { status } = await searchParams;

  let query = supabase
    .from("jobs")
    .select("id, title, status, scheduled_start, scheduled_end, total_amount, customers(first_name, last_name, company_name, email), properties(address_line1, city, state)")
    .eq("organization_id", organizationId)
    .order("scheduled_start", { ascending: true });
  if (status) query = query.eq("status", status);
  const { data } = await query;

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
        <JobsList rows={data as unknown as JobRow[]} />
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
