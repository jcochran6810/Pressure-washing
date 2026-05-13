import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { CalendarBoard } from "@/components/calendar-board";
import { getCalendarAccessToken, listEvents, type GoogleEvent } from "@/lib/google-calendar";

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

function eventStart(e: GoogleEvent): Date {
  const s = e.start.dateTime ?? e.start.date;
  return s ? new Date(s) : new Date();
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

  // Pull events from the linked Google Calendar, if connected.
  let googleEvents: GoogleEvent[] = [];
  let googleError: string | null = null;
  let calendarName: string | null = null;
  let calendarConnected = false;
  try {
    const conn = await getCalendarAccessToken(organizationId);
    if (conn?.conn?.calendar_id) {
      calendarConnected = true;
      calendarName = conn.conn.calendar_name ?? conn.conn.calendar_id;
      googleEvents = await listEvents({
        access_token: conn.token,
        calendar_id: conn.conn.calendar_id,
        timeMin: start,
        timeMax: end,
      });
    }
  } catch (e) {
    googleError = (e as Error).message;
  }

  const today = new Date();
  const todayIso = isoDate(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = isoDate(d);
    const events = googleEvents.filter((ev) => isoDate(eventStart(ev)) === iso);
    return {
      iso,
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayOfMonth: d.getDate(),
      isToday: iso === todayIso,
      events,
    };
  });

  const prevWeek = new Date(start); prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(start); nextWeek.setDate(nextWeek.getDate() + 7);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Calendar</h1>
          <p className="text-sm text-gray-600">
            {start.toLocaleDateString()} – {new Date(end.getTime() - 1).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/calendar?week=${isoDate(prevWeek)}`} className="btn-secondary">← Prev</Link>
          <Link href="/calendar" className="btn-secondary">Today</Link>
          <Link href={`/calendar?week=${isoDate(nextWeek)}`} className="btn-secondary">Next →</Link>
          <Link href="/jobs/new" className="btn-primary">+ New job</Link>
        </div>
      </div>

      {calendarConnected ? (
        <div className="mb-3 text-xs text-gray-600 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          Syncing events from <strong>{calendarName}</strong>
          <Link href="/settings#calendar" className="text-brand-600 hover:underline">Change</Link>
        </div>
      ) : (
        <div className="mb-3 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900 flex items-center justify-between gap-3 flex-wrap">
          <span>
            Connect Google Calendar so the events on your linked calendar appear here.
          </span>
          <Link href="/settings#calendar" className="text-amber-900 underline font-medium">
            Connect Google Calendar
          </Link>
        </div>
      )}

      {googleError && (
        <div className="mb-3 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
          Couldn't load Google Calendar events: {googleError}
        </div>
      )}

      <CalendarBoard days={days} jobs={(jobs ?? []) as any} />
    </div>
  );
}
