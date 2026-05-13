"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type Notification = {
  id: string;
  title: string;
  detail?: string;
  href: string;
  tone: "alert" | "warning" | "info";
};

export function NotificationsBell({
  notifications,
  align = "right",
  size = "md",
}: {
  notifications: Notification[];
  align?: "left" | "right";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [seenOnce, setSeenOnce] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const count = notifications.length;
  const has = count > 0;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDocClick);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Auto-open once per session when there are notifications, so the user sees them.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!has) return;
    if (seenOnce) return;
    const key = "notif_pop_v1";
    try {
      const last = sessionStorage.getItem(key);
      const sig = notifications.map((n) => n.id).sort().join(",");
      if (last !== sig) {
        setOpen(true);
        sessionStorage.setItem(key, sig);
      }
    } catch {
      // ignore
    }
    setSeenOnce(true);
  }, [has, notifications, seenOnce]);

  const dim = size === "sm" ? "w-8 h-8" : "w-9 h-9";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${count ? ` (${count})` : ""}`}
        className={cn(
          dim,
          "grid place-items-center rounded-full text-gray-700 hover:bg-gray-100 relative",
        )}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {has && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-2 w-[320px] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden",
            align === "right" ? "right-0" : "left-0",
          )}
          role="dialog"
          aria-label="Notifications"
        >
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {has && <span className="text-xs text-gray-500">{count}</span>}
          </div>
          {has ? (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50"
                  >
                    <ToneDot tone={n.tone} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-900">{n.title}</span>
                      {n.detail && (
                        <span className="block text-xs text-gray-500 mt-0.5 truncate">{n.detail}</span>
                      )}
                    </span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-gray-300 mt-0.5"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              You're all caught up.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToneDot({ tone }: { tone: Notification["tone"] }) {
  const cls =
    tone === "alert"
      ? "bg-red-500"
      : tone === "warning"
        ? "bg-amber-500"
        : "bg-blue-500";
  return <span className={cn("w-2 h-2 mt-1.5 rounded-full flex-shrink-0", cls)} aria-hidden />;
}
