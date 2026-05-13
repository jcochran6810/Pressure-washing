"use client";

import { useState } from "react";

type ServerAction = (formData: FormData) => Promise<string>;
type NoArgsAction = () => Promise<string>;

export function CsvDownloadForm({
  action,
  filename,
  label,
  hint,
  withDateRange = true,
}: {
  action: ServerAction | NoArgsAction;
  filename: string;
  label: string;
  hint?: string;
  withDateRange?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const csv = withDateRange ? await (action as ServerAction)(fd) : await (action as NoArgsAction)();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="card-padded">
      <h3 className="font-semibold">{label}</h3>
      {hint && <p className="text-xs text-gray-500 mt-1 mb-2">{hint}</p>}
      {withDateRange && (
        <div className="grid grid-cols-2 gap-2 mb-2 text-sm">
          <label className="text-xs text-gray-600">From
            <input type="date" name="from" className="w-full mt-0.5" />
          </label>
          <label className="text-xs text-gray-600">To
            <input type="date" name="to" className="w-full mt-0.5" />
          </label>
        </div>
      )}
      <button type="submit" disabled={busy} className="btn-secondary text-xs">
        {busy ? "Generating…" : "Download CSV"}
      </button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </form>
  );
}
