"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { listGoogleEventsForDay, scheduleJob, scheduleJobImmediately, type DaySchedule } from "@/app/(app)/jobs/actions";

const DEFAULT_DURATION_MIN = 60;

function todayDateIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function nowTimeHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function combineDateTime(dateIso: string, timeHHMM: string) {
  if (!dateIso || !timeHHMM) return "";
  return `${dateIso}T${timeHHMM}`;
}

function addMinutes(dateTimeLocal: string, minutes: number) {
  if (!dateTimeLocal) return "";
  const d = new Date(dateTimeLocal);
  if (Number.isNaN(d.getTime())) return "";
  d.setMinutes(d.getMinutes() + minutes);
  const y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${M}-${dd}T${hh}:${mm}`;
}

function fmtTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function ScheduleJobForm({ jobId }: { jobId: string }) {
  const today = todayDateIso();
  const [date, setDate] = useState<string>(today);
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime, setEndTime] = useState<string>("");
  const [day, setDay] = useState<DaySchedule | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Refetch when date changes
  useEffect(() => {
    let cancelled = false;
    setLoadingDay(true);
    listGoogleEventsForDay(date)
      .then((r) => {
        if (!cancelled) setDay(r);
      })
      .catch(() => {
        if (!cancelled) setDay({ events: [], calendarName: null, connected: false });
      })
      .finally(() => {
        if (!cancelled) setLoadingDay(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  // Validation: can't schedule in the past relative to the user's local clock.
  const isPast = useMemo(() => {
    if (!date || !startTime) return false;
    const local = new Date(`${date}T${startTime}`);
    return Number.isFinite(local.getTime()) && local.getTime() < Date.now();
  }, [date, startTime]);

  // For a "today" date, the time picker should not allow times earlier than now.
  const startTimeMin = date === today ? nowTimeHHMM() : undefined;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!date || !startTime) {
      setError("Pick a date and start time.");
      return;
    }
    if (isPast) {
      setError("That time has already passed — pick a future time.");
      return;
    }
    const start = combineDateTime(date, startTime);
    const end = endTime ? combineDateTime(date, endTime) : "";
    const fd = new FormData();
    fd.set("scheduled_start", start);
    if (end) fd.set("scheduled_end", end);
    setError(null);
    startTransition(async () => {
      try {
        await scheduleJob(jobId, fd);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function onStartNow() {
    setError(null);
    startTransition(async () => {
      try {
        await scheduleJobImmediately(jobId);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  function bookSlot(afterIsoOrUndefined: string | undefined, defaultHour = 9) {
    // Default to 9am if there's no anchor; otherwise start at the end of the prior event.
    let h = defaultHour;
    let mm = 0;
    if (afterIsoOrUndefined) {
      const d = new Date(afterIsoOrUndefined);
      h = d.getHours();
      mm = d.getMinutes();
    }
    const hh = String(h).padStart(2, "0");
    const min = String(mm).padStart(2, "0");
    setStartTime(`${hh}:${min}`);
    setEndTime("");
  }

  const startDateTimeLocal = combineDateTime(date, startTime);
  const suggestedEnd =
    !endTime && startDateTimeLocal ? addMinutes(startDateTimeLocal, DEFAULT_DURATION_MIN).slice(11, 16) : endTime;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-xs text-gray-700">
          Date
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full mt-0.5"
          />
        </label>
        <label className="text-xs text-gray-700">
          Start time
          <input
            type="time"
            value={startTime}
            min={startTimeMin}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className="w-full mt-0.5"
          />
        </label>
        <label className="text-xs text-gray-700">
          End (optional)
          <input
            type="time"
            value={endTime}
            placeholder={suggestedEnd}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full mt-0.5"
          />
        </label>
      </div>

      <CalendarPanel
        date={date}
        day={day}
        loading={loadingDay}
        onPickSlot={(afterIso) => bookSlot(afterIso)}
      />

      <div className="flex flex-wrap gap-2 items-center">
        <button type="submit" disabled={pending || isPast} className="btn-primary text-base px-5 py-3 disabled:opacity-60">
          {pending ? "Scheduling…" : "📅 Schedule job"}
        </button>
        <button
          type="button"
          onClick={onStartNow}
          disabled={pending}
          className="btn-secondary text-base px-5 py-3 disabled:opacity-60"
          title="Schedule for right now and mark the job in-progress"
        >
          ▶ Schedule for immediately
        </button>
        {isPast && !error && (
          <span className="text-xs text-red-600">That start time has already passed.</span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}

function CalendarPanel({
  date,
  day,
  loading,
  onPickSlot,
}: {
  date: string;
  day: DaySchedule | null;
  loading: boolean;
  onPickSlot: (afterIso?: string) => void;
}) {
  const formattedDate = (() => {
    if (!date) return "";
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  })();

  if (!day && loading) {
    return <p className="text-xs text-gray-500">Checking your Google Calendar…</p>;
  }

  if (!day?.connected) {
    return (
      <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-2">
        Connect Google Calendar in{" "}
        <Link href="/settings#calendar" className="text-brand-600 underline">
          Settings
        </Link>{" "}
        to see what's already booked when scheduling.
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="px-3 py-2 border-b flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-gray-600">
          <span className="font-medium text-gray-800">{formattedDate}</span>{" "}
          on <span className="font-medium">{day.calendarName ?? "Google Calendar"}</span>
        </div>
        {loading && <span className="text-[11px] text-gray-400">Refreshing…</span>}
      </div>
      {day.events.length === 0 ? (
        <div className="px-3 py-4 text-sm text-gray-500 flex items-center justify-between gap-3">
          <span>Nothing on the calendar that day — you're clear.</span>
          <button
            type="button"
            onClick={() => onPickSlot(undefined)}
            className="btn-secondary text-xs"
          >
            Use 9:00 AM
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {day.events.map((e) => (
            <li key={e.id} className="px-3 py-2 flex items-center gap-3">
              <span className="w-1 self-stretch bg-blue-400 rounded" aria-hidden />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{e.summary}</p>
                <p className="text-xs text-gray-500">
                  {e.allDay
                    ? "All day"
                    : `${fmtTime(e.start)} – ${fmtTime(e.end)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onPickSlot(e.end)}
                className="btn-secondary text-xs whitespace-nowrap"
                title="Schedule right after this event"
              >
                Book after
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
