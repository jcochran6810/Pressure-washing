"use client";

import { useState } from "react";

type DownloadAllAction = (formData: FormData) => Promise<{
  base64: string;
  filename: string;
  rowCounts: { invoices: number; payments: number; expenses: number; customers: number };
}>;

export function DownloadAllForm({
  action,
  label = "Download all (zip)",
  hint = "Invoices, payments, expenses, and customers as separate CSVs in one zip.",
}: {
  action: DownloadAllAction;
  label?: string;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLastSummary(null);
    try {
      const fd = new FormData(e.currentTarget);
      const result = await action(fd);
      const binary = atob(result.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const c = result.rowCounts;
      setLastSummary(
        `${c.invoices} invoices · ${c.payments} payments · ${c.expenses} expenses · ${c.customers} customers`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="card-padded">
      <h3 className="font-semibold">{label}</h3>
      <p className="text-xs text-gray-500 mt-1 mb-2">{hint}</p>
      <div className="grid grid-cols-2 gap-2 mb-2 text-sm">
        <label className="text-xs text-gray-600">
          From
          <input type="date" name="from" className="w-full mt-0.5" />
        </label>
        <label className="text-xs text-gray-600">
          To
          <input type="date" name="to" className="w-full mt-0.5" />
        </label>
      </div>
      <p className="text-[11px] text-gray-400 mb-2">Leave both blank for the full history.</p>
      <button type="submit" disabled={busy} className="btn-primary text-xs">
        {busy ? "Bundling…" : label}
      </button>
      {lastSummary && <p className="text-xs text-green-700 mt-2">Downloaded · {lastSummary}</p>}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </form>
  );
}
