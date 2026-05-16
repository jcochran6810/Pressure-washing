"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  entityType: "estimate" | "invoice";
  entityId?: string | null;
  formId: string;
  intervalMs?: number;
};

// Serializes the named form to JSON, posts to /api/drafts, and shows a
// "Saved · 12s ago" indicator. Triggers on user input (debounced) and an
// interval to catch idle changes (e.g. someone moves a slider).
export function AutoSave({ entityType, entityId, formId, intervalMs = 8000 }: Props) {
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastPayload = useRef<string>("");

  function collect(): Record<string, any> | null {
    if (typeof document === "undefined") return null;
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return null;
    const fd = new FormData(form);
    const obj: Record<string, any> = {};
    for (const [k, v] of fd.entries()) {
      if (v instanceof File) continue;
      if (k in obj) {
        const prev = obj[k];
        if (Array.isArray(prev)) prev.push(v);
        else obj[k] = [prev, v];
      } else {
        obj[k] = v;
      }
    }
    return obj;
  }

  async function save() {
    const payload = collect();
    if (!payload) return;
    const body = JSON.stringify({ entityType, entityId: entityId ?? null, payload });
    if (body === lastPayload.current) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      lastPayload.current = body;
      setSavedAt(new Date());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Restore once on mount if there's an existing draft for this entity
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const u = new URL("/api/drafts", window.location.origin);
        u.searchParams.set("entityType", entityType);
        if (entityId) u.searchParams.set("entityId", entityId);
        const res = await fetch(u.toString(), { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled || !j.draft) return;
        const form = document.getElementById(formId) as HTMLFormElement | null;
        if (!form) return;
        const payload = j.draft.payload || {};
        for (const [name, value] of Object.entries(payload)) {
          const elements = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${name}"]`);
          if (!elements.length) continue;
          if (Array.isArray(value)) {
            elements.forEach((el, i) => {
              if (value[i] != null) (el as any).value = value[i];
            });
          } else {
            elements.forEach((el) => {
              if (el instanceof HTMLInputElement && el.type === "checkbox") {
                el.checked = String(value) === "on" || value === true;
              } else {
                (el as any).value = String(value);
              }
            });
          }
        }
        setRestored(true);
      } catch {}
    }
    restore();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId, formId]);

  useEffect(() => {
    const id = setInterval(save, intervalMs);
    const form = document.getElementById(formId);
    const onInput = () => { void save(); };
    if (form) {
      form.addEventListener("input", onInput);
      form.addEventListener("change", onInput);
    }
    return () => {
      clearInterval(id);
      if (form) {
        form.removeEventListener("input", onInput);
        form.removeEventListener("change", onInput);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId, formId, intervalMs]);

  return (
    <div className="text-xs text-gray-500 flex items-center gap-2">
      {saving ? (
        <span className="text-amber-700">Saving draft…</span>
      ) : error ? (
        <span className="text-red-600">{error}</span>
      ) : savedAt ? (
        <span className="text-green-700">✓ Draft saved {timeAgo(savedAt)}</span>
      ) : (
        <span>Auto-saves as you type</span>
      )}
      {restored && <span className="text-brand-700">· restored from earlier draft</span>}
    </div>
  );
}

function timeAgo(d: Date) {
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return d.toLocaleTimeString();
}
