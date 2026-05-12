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

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonth(d: Date) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

type Search = { week?: string; month?: string; view?: string };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const sp = await searchParams;
  const view = sp.view === "month" ? "month" : "week";

  if (view === "month") {
    return renderMonth(sp, supabase, organizationId);
  }
  return renderWeek(sp, supabase, organizationId);
}

async function renderWeek(sp: Search, supabase: any, organizationId: string) {
  const base = sp.week ? new Date(sp.week) : new Date();
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
        <div className="flex gap-2 flex-wrap">
          <ViewToggle view="week" />
          <Link href={`/calendar?week=${prevWeek.toISOString().slice(0, 10)}`} className="btn-secondary">← Prev</Link>
          <Link href="/calendar" className="btn-secondary">Today</Link>
          <Link href={`/calendar?week=${nextWeek.toISOString().slice(0, 10)}`} className="btn-secondary">Next →</Link>
          <Link href="/jobs/new" className="btn-primary">+ New job</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {days.map((d) => {
          const dayJobs = (jobs ?? []).filter((j: any) => {
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

async function renderMonth(sp: Search, supabase: any, organizationId: string) {
  const base = sp.month ? new Date(sp.month + "-01T00:00:00") : new Date();
  const monthStart = startOfMonth(base);
  const monthEnd = endOfMonth(base);

  // Grid starts on the Sunday before (or on) the 1st, and runs 42 days (6 weeks).
  const gridStart = startOfWeek(monthStart);
  const gridEnd = new Date(gridStart); gridEnd.setDate(gridEnd.getDate() + 42);

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, scheduled_start, status, customers(first_name, last_name, company_name)")
    .eq("organization_id", organizationId)
    .gte("scheduled_start", gridStart.toISOString())
    .lt("scheduled_start", gridEnd.toISOString())
    .order("scheduled_start");

  const days: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart); d.setDate(d.getDate() + i); return d;
  });

  const prevMonth = new Date(monthStart); prevMonth.setMonth(prevMonth.getMonth() - 1);
  const nextMonth = new Date(monthStart); nextMonth.setMonth(nextMonth.getMonth() + 1);
  const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const today = new Date();
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Pre-bucket jobs by yyyy-mm-dd for O(1) lookup per day cell.
  const byDate = new Map<string, any[]>();
  for (const j of (jobs ?? []) as any[]) {
    if (!j.scheduled_start) continue;
    const d = new Date(j.scheduled_start);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const arr = byDate.get(key) ?? [];
    arr.push(j);
    byDate.set(key, arr);
  }
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Calendar</h1>
          <p className="text-sm text-gray-600">{monthLabel}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ViewToggle view="month" />
          <Link href={`/calendar?view=month&month=${ym(prevMonth)}`} className="btn-secondary">← Prev</Link>
          <Link href="/calendar?view=month" className="btn-secondary">Today</Link>
          <Link href={`/calendar?view=month&month=${ym(nextMonth)}`} className="btn-secondary">Next →</Link>
          <Link href="/jobs/new" className="btn-primary">+ New job</Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1 text-xs font-semibold text-gray-500 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = d.getMonth() === monthStart.getMonth();
          const isToday = d.toDateString() === today.toDateString();
          const dayJobs = byDate.get(dayKey(d)) ?? [];
          const visible = dayJobs.slice(0, 3);
          const overflow = dayJobs.length - visible.length;
          return (
            <div
              key={d.toISOString()}
              className={`min-h-[88px] sm:min-h-[112px] rounded border text-xs flex flex-col ${
                inMonth ? "bg-white" : "bg-gray-50 text-gray-400"
              } ${isToday ? "border-brand-500 ring-1 ring-brand-200" : "border-gray-200"}`}
            >
              <div className="px-1.5 py-1 flex items-center justify-between">
                <span className={`${isToday ? "font-bold text-brand-700" : "text-gray-600"}`}>{d.getDate()}</span>
                {dayJobs.length > 0 && (
                  <span className="text-[10px] text-gray-400 tabular-nums">{dayJobs.length}</span>
                )}
              </div>
              <div className="px-1 pb-1 space-y-0.5 flex-1">
                {visible.map((j) => (
                  <Link
                    key={j.id}
                    href={`/jobs/${j.id}`}
                    className={`block px-1 py-0.5 rounded truncate hover:opacity-80 ${statusColor(j.status)}`}
                    title={`${j.title} — ${customerDisplayName(j.customers ?? {})}`}
                  >
                    {new Date(j.scheduled_start).toLocaleTimeString("en-US", { hour: "numeric" })} {j.title}
                  </Link>
                ))}
                {overflow > 0 && (
                  <p className="text-[10px] text-gray-500 px-1">+ {overflow} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ViewToggle({ view }: { view: "week" | "month" }) {
  return (
    <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-sm">
      <Link
        href="/calendar"
        className={`px-3 py-1.5 ${view === "week" ? "bg-brand-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
      >
        Week
      </Link>
      <Link
        href="/calendar?view=month"
        className={`px-3 py-1.5 border-l border-gray-300 ${view === "month" ? "bg-brand-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
      >
        Month
      </Link>
    </div>
  );
}
