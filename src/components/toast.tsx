"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type ToastTone = "success" | "error" | "info" | "warning";

type Toast = {
  id: string;
  tone: ToastTone;
  title?: string;
  message: string;
  durationMs?: number;
};

type ToastContextValue = {
  show: (t: Omit<Toast, "id">) => void;
  success: (msg: string, title?: string) => void;
  error: (msg: string, title?: string) => void;
  info: (msg: string, title?: string) => void;
  warning: (msg: string, title?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = crypto.randomUUID();
      const toast: Toast = { id, durationMs: 5000, ...t };
      setToasts((prev) => [...prev, toast]);
      if (toast.durationMs && toast.durationMs > 0) {
        setTimeout(() => remove(id), toast.durationMs);
      }
    },
    [remove],
  );

  const api = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message, title) => show({ tone: "success", message, title }),
      error: (message, title) => show({ tone: "error", message, title, durationMs: 8000 }),
      info: (message, title) => show({ tone: "info", message, title }),
      warning: (message, title) => show({ tone: "warning", message, title }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <ToastBubble key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastBubble({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const tone = toast.tone;
  const cls =
    tone === "success"
      ? "bg-green-50 border-green-200 text-green-900"
      : tone === "error"
        ? "bg-red-50 border-red-200 text-red-900"
        : tone === "warning"
          ? "bg-amber-50 border-amber-200 text-amber-900"
          : "bg-blue-50 border-blue-200 text-blue-900";

  return (
    <div
      role="status"
      className={`shadow-md rounded-lg border px-4 py-3 text-sm flex items-start gap-3 ${cls}`}
    >
      <div className="flex-1 min-w-0">
        {toast.title && <p className="font-semibold leading-tight">{toast.title}</p>}
        <p className="leading-snug whitespace-pre-wrap">{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-current opacity-60 hover:opacity-100 leading-none"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
}

// Helper: surface a one-shot toast via the URL ?toast= query param.
// Useful for server-action redirects that need to display a confirmation.
export function ToastFromSearchParams() {
  const ctx = useContext(ToastContext);
  useEffect(() => {
    if (!ctx) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const msg = url.searchParams.get("toast");
    if (!msg) return;
    const tone = (url.searchParams.get("toast_tone") as ToastTone | null) || "info";
    ctx.show({ tone, message: msg });
    url.searchParams.delete("toast");
    url.searchParams.delete("toast_tone");
    window.history.replaceState({}, "", url.toString());
  }, [ctx]);
  return null;
}
