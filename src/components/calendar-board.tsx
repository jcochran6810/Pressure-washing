"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { moveJobToDate } from "@/app/(app)/jobs/actions";
import { customerDisplayName, statusColor } from "@/lib/utils";

type CalJob = {
  id: string;
  title: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  status: string | null;
  total_amount: number | null;
  customers: any;
};

type GCalEvent = {
  id: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
};

type Day = { iso: string; label: string; dayOfMonth: number; isToday: boolean; events?: GCalEvent[] };

export function CalendarBoard({ days, jobs }: { days: Day[]; jobs: CalJob[] }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const [optimisticMoves, setOptimisticMoves] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function jobDayIso(j: CalJob): string | null {
    if (optimisticMoves[j.id]) return optimisticMoves[j.id];
    if (!j.scheduled_start) return null;
    const d = new Date(j.scheduled_start);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  function handleDrop(iso: string) {
    if (!draggingId) return;
    const id = draggingId;
    setDraggingId(null);
    setHoverIso(null);
    setOptimisticMoves((prev) => ({ ...prev, [id]: iso }));
    setError(null);
    startTransition(async () => {
      try {
        await moveJobToDate(id, iso);
      } catch (e) {
        setOptimisticMoves((prev) => {
          const { [id]: _, ...rest } = prev;
          return rest;
        });
        setError((e as Error).message);
      }
    });
  }

  return (
    <>
      {error && (
        <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {days.map((d) => {
          const dayJobs = jobs.filter((j) => jobDayIso(j) === d.iso);
          const isHover = hoverIso === d.iso && draggingId !== null;
          return (
            <div
              key={d.iso}
              onDragOver={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                setHoverIso(d.iso);
              }}
              onDragLeave={() => setHoverIso((h) => (h === d.iso ? null : h))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(d.iso);
              }}
              className={`card border min-h-[140px] transition ${
                d.isToday ? "border-brand-500 ring-1 ring-brand-200" : "border-gray-200"
              } ${isHover ? "bg-brand-50 ring-2 ring-brand-400" : ""}`}
            >
              <header className="px-2 py-1.5 border-b text-xs flex justify-between">
                <span className="font-semibold">{d.label}</span>
                <span className="text-gray-500">{d.dayOfMonth}</span>
              </header>
              <div className="p-1.5 space-y-1">
                {dayJobs.length === 0 && (!d.events || d.events.length === 0) && (
                  <p className="text-xs text-gray-400 text-center py-3">—</p>
                )}
                {dayJobs.map((j) => (
                  <div
                    key={j.id}
                    draggable
                    onDragStart={() => setDraggingId(j.id)}
                    onDragEnd={() => setDraggingId(null)}
                    className={`group relative ${
                      draggingId === j.id ? "opacity-40" : ""
                    } ${optimisticMoves[j.id] && pending ? "ring-1 ring-brand-300" : ""}`}
                  >
                    <Link
                      href={`/jobs/${j.id}`}
                      className="block p-1.5 rounded bg-gray-50 hover:bg-brand-50 text-xs cursor-grab active:cursor-grabbing"
                    >
                      <p className="font-medium truncate">{j.title}</p>
                      <p className="text-gray-500 truncate">{customerDisplayName(j.customers ?? {})}</p>
                      {j.scheduled_start && (
                        <p className="text-gray-400">
                          {new Date(j.scheduled_start).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                      <span className={`badge ${statusColor(j.status)} text-[10px]`}>
                        {j.status?.replace("_", " ")}
                      </span>
                    </Link>
                  </div>
                ))}
                {d.events?.map((ev) => {
                  const startStr = ev.start.dateTime ?? ev.start.date;
                  const isAllDay = !ev.start.dateTime;
                  return (
                    <a
                      key={ev.id}
                      href={ev.htmlLink}
                      target="_blank"
                      rel="noopener"
                      className="block p-1.5 rounded text-xs bg-blue-50 hover:bg-blue-100 border-l-2 border-blue-500"
                      title={ev.summary || "Google event"}
                    >
                      <p className="font-medium truncate text-blue-900">{ev.summary || "Untitled"}</p>
                      <p className="text-blue-700/80 text-[10px]">
                        {isAllDay
                          ? "All day"
                          : startStr
                            ? new Date(startStr).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : ""}
                        <span className="ml-1 text-blue-500">· Google</span>
                      </p>
                      {ev.location && (
                        <p className="text-blue-700/70 text-[10px] truncate">{ev.location}</p>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Tip: drag a job card onto another day to reschedule. Time-of-day is preserved.
      </p>
    </>
  );
}
