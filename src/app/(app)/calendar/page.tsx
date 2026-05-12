import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { customerDisplayName, statusColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const dow = x.getDay();
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { week } = await searchParams;
  const base = week ? new Date(week) : new Date();
  const start = startOfWeek(base);
  const end = new Date(start); end.setDate(end.getDate() + 7);

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, scheduled_start, scheduled_end, status, total_amount, customers(first_name, last_name, company_name)")
    .eq("organization_id", organizationId)
    .gte("scheduled_start", start.toISOString())
    .lt("scheduled_start", end.toISOString())
    .order("scheduled_start");

  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i); return d;
  });

  const prevWeek = new Date(start); prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(start); nextWeek.setDate(nextWeek.getDate() + 7);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Calendar</h1>
          <p className="text-sm text-gray-600">{start.toLocaleDateString()} – {new Date(end.getTime() - 1).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/calendar?week=${prevWeek.toISOString().slice(0, 10)}`} className="btn-secondary">← Prev</Link>
          <Link href="/calendar" className="btn-secondary">Today</Link>
          <Link href={`/calendar?week=${nextWeek.toISOString().slice(0, 10)}`} className="btn-secondary">Next →</Link>
          <Link href="/jobs/new" className="btn-primary">+ New job</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {days.map((d) => {
          const dayJobs = (jobs ?? []).filter((j) => {
            if (!j.scheduled_start) return false;
            const js = new Date(j.scheduled_start);
            return js.toDateString() === d.toDateString();
          });
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div key={d.toISOString()} className={`card border ${isToday ? "border-brand-500 ring-1 ring-brand-200" : "border-gray-200"} min-h-[140px]`}>
              <header className="px-2 py-1.5 border-b text-xs flex justify-between">
                <span className="font-semibold">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
                <span className="text-gray-500">{d.getDate()}</span>
              </header>
              <div className="p-1.5 space-y-1">
                {dayJobs.length === 0 && <p className="text-xs text-gray-400 text-center py-3">—</p>}
                {dayJobs.map((j: any) => (
                  <Link key={j.id} href={`/jobs/${j.id}`} className="block p-1.5 rounded bg-gray-50 hover:bg-brand-50 text-xs">
                    <p className="font-medium truncate">{j.title}</p>
                    <p className="text-gray-500 truncate">{customerDisplayName(j.customers ?? {})}</p>
                    <p className="text-gray-400">{new Date(j.scheduled_start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                    <span className={`badge ${statusColor(j.status)} text-[10px]`}>{j.status?.replace("_", " ")}</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
