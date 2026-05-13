"use client";

import { ReactNode, useMemo, useState, useTransition } from "react";
import { useToast } from "@/components/toast";

export type BulkResult = { ok: number; failed: number; errors: string[] };

export type BulkActionDef = {
  key: string;
  label: string;
  busyLabel?: string;
  tone?: "primary" | "secondary" | "danger";
  confirm?: (count: number) => string;
  successTitle?: string;
  run: (ids: string[]) => Promise<BulkResult>;
};

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  cellClass?: string;
  headerClass?: string;
};

export function BulkActionTable<T extends { id: string }>({
  rows,
  columns,
  actions,
  itemNoun = "item",
  rowKey,
}: {
  rows: T[];
  columns: Column<T>[];
  actions: BulkActionDef[];
  itemNoun?: string;
  rowKey?: (row: T) => string;
}) {
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const allIds = useMemo(() => rows.map((r) => (rowKey ? rowKey(r) : r.id)), [rows, rowKey]);
  const allSelected = selected.size > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runAction(action: BulkActionDef) {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (action.confirm) {
      const ok = window.confirm(action.confirm(ids.length));
      if (!ok) return;
    }
    setBusyKey(action.key);
    try {
      const result = await action.run(ids);
      const noun = ids.length === 1 ? itemNoun : `${itemNoun}s`;
      const title = action.successTitle ?? action.label;
      if (result.failed === 0) {
        toast.success(`${result.ok} ${noun} processed.`, title);
      } else if (result.ok === 0) {
        toast.error(result.errors[0] ?? `${result.failed} failed.`, title);
      } else {
        toast.warning(
          `${result.ok} succeeded, ${result.failed} failed.${result.errors[0] ? `\n${result.errors[0]}` : ""}`,
          title,
        );
      }
      if (result.ok > 0) {
        setSelected(new Set());
        startTransition(() => {
          // Trigger client re-render once revalidation completes server-side
        });
      }
    } catch (e) {
      toast.error((e as Error).message, action.label);
    } finally {
      setBusyKey(null);
    }
  }

  const busy = busyKey !== null;
  const hasSelection = selected.size > 0;

  return (
    <div>
      <div
        className={`flex flex-wrap items-center gap-2 mb-3 transition-opacity ${
          hasSelection ? "opacity-100" : "opacity-60"
        }`}
      >
        <span className="text-sm font-medium text-gray-700">
          {hasSelection ? `${selected.size} selected` : "Select rows to act on multiple"}
        </span>
        <div className="flex flex-wrap gap-2 ml-auto">
          {actions.map((a) => {
            const cls =
              a.tone === "danger"
                ? "btn-ghost text-red-600 hover:bg-red-50 disabled:opacity-40"
                : a.tone === "primary"
                  ? "btn-primary disabled:opacity-50"
                  : "btn-secondary disabled:opacity-50";
            return (
              <button
                key={a.key}
                type="button"
                className={`${cls} text-sm`}
                disabled={!hasSelection || busy}
                onClick={() => runAction(a)}
              >
                {busyKey === a.key ? (a.busyLabel ?? "Working…") : a.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                />
              </th>
              {columns.map((c) => (
                <th key={c.key} className={c.headerClass}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = rowKey ? rowKey(row) : row.id;
              const checked = selected.has(id);
              return (
                <tr key={id} className={checked ? "bg-brand-50/40" : undefined}>
                  <td className="w-8">
                    <input
                      type="checkbox"
                      aria-label={`Select ${id}`}
                      checked={checked}
                      onChange={() => toggleOne(id)}
                    />
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className={c.cellClass}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
