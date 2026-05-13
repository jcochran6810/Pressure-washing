"use client";

import { useTransition } from "react";
import type { GoogleCalendar } from "@/lib/google-calendar";
import { setLinkedCalendar } from "@/app/(app)/settings/actions";

export function CalendarPicker({
  calendars,
  currentCalendarId,
}: {
  calendars: GoogleCalendar[];
  currentCalendarId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  async function onSelect(c: GoogleCalendar) {
    const fd = new FormData();
    fd.set("calendar_id", c.id);
    fd.set("calendar_name", c.summary);
    startTransition(async () => {
      await setLinkedCalendar(fd);
    });
  }

  if (!calendars.length) {
    return (
      <p className="text-xs text-gray-600">
        No calendars returned. Make sure you granted calendar access when connecting.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {calendars.map((c) => {
        const isCurrent = c.id === currentCalendarId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c)}
            disabled={pending || isCurrent}
            className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 border ${
              isCurrent
                ? "border-brand-300 bg-brand-50 text-brand-800 cursor-default"
                : "border-gray-200 hover:bg-gray-50"
            } disabled:opacity-60`}
          >
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: c.backgroundColor || "#9ca3af" }}
            />
            <span className="flex-1 truncate">{c.summary}</span>
            {c.primary && <span className="text-[10px] text-gray-500 uppercase">Primary</span>}
            {isCurrent && <span className="text-xs text-brand-600 font-medium">Linked</span>}
          </button>
        );
      })}
    </div>
  );
}
