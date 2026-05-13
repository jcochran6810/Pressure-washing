import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { CalendarBoard } from "@/components/calendar-board";

export const dynamic = "force-dynamic";

function startOfWeek(d: Date) {
  const x = new Date(d);
  const dow = x.getDay();
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { week } = await searchParams;
  const base = week ? new Date(week) : new Date();
  const start = startOfWeek(base);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, scheduled_start, scheduled_end, status, total_amount, customers(first_name, last_name, company_name)")
    .eq("organization_id", organizationId)
    .gte("scheduled_start", start.toISOString())
    .lt("scheduled_start", end.toISOString())
    .order("scheduled_start");

  const today = new Date();
  const todayIso = isoDate(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return {
      iso: isoDate(d),
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayOfMonth: d.getDate(),
      isToday: isoDate(d) === todayIso,
    };
  });

  const prevWeek = new Date(start); prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(start); nextWeek.setDate(nextWeek.getDate() + 7);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Calendar</h1>
          <p className="text-sm text-gray-600">
            {start.toLocaleDateString()} – {new Date(end.getTime() - 1).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/calendar?week=${isoDate(prevWeek)}`} className="btn-secondary">← Prev</Link>
          <Link href="/calendar" className="btn-secondary">Today</Link>
          <Link href={`/calendar?week=${isoDate(nextWeek)}`} className="btn-secondary">Next →</Link>
          <Link href="/jobs/new" className="btn-primary">+ New job</Link>
        </div>
      </div>

      <CalendarBoard days={days} jobs={(jobs ?? []) as any} />
    </div>
  );
}
