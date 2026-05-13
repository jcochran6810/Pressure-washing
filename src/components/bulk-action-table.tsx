"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

export type BulkResult = { ok: number; failed: number; errors: string[] };

export type BulkActionDef = {
  key: string;
  label: string;
  busyLabel?: string;
  tone?: "primary" | "secondary" | "danger";
  confirm?: (count: number) => string;
  successTitle?: string;
  // Hide from per-row long-press menu (e.g. when only meaningful for >1 row)
  hideInRowMenu?: boolean;
  // Disable the per-row menu item based on the row data
  disabledForRow?: (row: any) => string | null;
  run: (ids: string[]) => Promise<BulkResult>;
};

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  cellClass?: string;
  headerClass?: string;
};

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

export function BulkActionTable<T extends { id: string }>({
  rows,
  columns,
  actions,
  itemNoun = "item",
  rowKey,
  rowHref,
}: {
  rows: T[];
  columns: Column<T>[];
  actions: BulkActionDef[];
  itemNoun?: string;
  rowKey?: (row: T) => string;
  rowHref?: (row: T) => string | null | undefined;
}) {
  const toast = useToast();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; row: T; x: number; y: number } | null>(null);

  const idOf = useCallback((row: T) => (rowKey ? rowKey(row) : row.id), [rowKey]);
  const allIds = useMemo(() => rows.map(idOf), [rows, idOf]);
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

  async function runAction(action: BulkActionDef, idsOverride?: string[]) {
    const ids = idsOverride ?? Array.from(selected);
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
      if (result.ok > 0 && !idsOverride) {
        setSelected(new Set());
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
          {hasSelection
            ? `${selected.size} selected`
            : "Tip: long-press a row for actions, or check boxes to act on multiple"}
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
            {rows.map((row) => (
              <Row
                key={idOf(row)}
                row={row}
                id={idOf(row)}
                columns={columns}
                checked={selected.has(idOf(row))}
                onToggle={() => toggleOne(idOf(row))}
                href={rowHref?.(row) ?? null}
                onOpenMenu={(x, y) => setMenu({ id: idOf(row), row, x, y })}
                onNavigate={(href) => router.push(href)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {menu && (
        <RowMenu
          actions={actions}
          row={menu.row}
          x={menu.x}
          y={menu.y}
          busy={busy}
          busyKey={busyKey}
          itemNoun={itemNoun}
          onClose={() => setMenu(null)}
          onRun={async (a) => {
            setMenu(null);
            await runAction(a, [menu.id]);
          }}
        />
      )}
    </div>
  );
}

function Row<T>({
  row,
  id,
  columns,
  checked,
  onToggle,
  href,
  onOpenMenu,
  onNavigate,
}: {
  row: T;
  id: string;
  columns: Column<T>[];
  checked: boolean;
  onToggle: () => void;
  href: string | null;
  onOpenMenu: (x: number, y: number) => void;
  onNavigate: (href: string) => void;
}) {
  const longPressHandlers = useLongPress({
    onLongPress: (x, y) => onOpenMenu(x, y),
  });

  function handleRowClick(e: React.MouseEvent) {
    if (!href) return;
    if (longPressHandlers.consumeSuppressed()) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, label, select, textarea")) return;
    onNavigate(href);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    onOpenMenu(e.clientX, e.clientY);
  }

  return (
    <tr
      className={`${checked ? "bg-brand-50/40 " : ""}${href ? "cursor-pointer select-none" : ""}`}
      onClick={handleRowClick}
      onContextMenu={handleContextMenu}
      onPointerDown={longPressHandlers.onPointerDown}
      onPointerMove={longPressHandlers.onPointerMove}
      onPointerUp={longPressHandlers.onPointerUp}
      onPointerCancel={longPressHandlers.onPointerCancel}
    >
      <td className="w-8" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label={`Select ${id}`}
          checked={checked}
          onChange={onToggle}
        />
      </td>
      {columns.map((c) => (
        <td key={c.key} className={c.cellClass}>
          {c.render(row)}
        </td>
      ))}
    </tr>
  );
}

function useLongPress({ onLongPress }: { onLongPress: (x: number, y: number) => void }) {
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const suppressClickRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only the primary button / single touch
      if (e.pointerType === "mouse" && e.button !== 0) return;
      firedRef.current = false;
      suppressClickRef.current = false;
      startRef.current = { x: e.clientX, y: e.clientY };
      const x = e.clientX;
      const y = e.clientY;
      timerRef.current = window.setTimeout(() => {
        firedRef.current = true;
        suppressClickRef.current = true;
        onLongPress(x, y);
      }, LONG_PRESS_MS);
    },
    [onLongPress],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startRef.current) return;
      const dx = Math.abs(e.clientX - startRef.current.x);
      const dy = Math.abs(e.clientY - startRef.current.y);
      if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) clear();
    },
    [clear],
  );

  const onPointerUp = useCallback(() => {
    clear();
  }, [clear]);

  const onPointerCancel = useCallback(() => {
    clear();
  }, [clear]);

  const consumeSuppressed = useCallback(() => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return true;
    }
    return false;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, consumeSuppressed };
}

function RowMenu<T>({
  actions,
  row,
  x,
  y,
  busy,
  busyKey,
  itemNoun,
  onRun,
  onClose,
}: {
  actions: BulkActionDef[];
  row: T;
  x: number;
  y: number;
  busy: boolean;
  busyKey: string | null;
  itemNoun: string;
  onRun: (a: BulkActionDef) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick as any);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick as any);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = x;
    let ny = y;
    if (nx + rect.width > vw - 8) nx = Math.max(8, vw - rect.width - 8);
    if (ny + rect.height > vh - 8) ny = Math.max(8, vh - rect.height - 8);
    setPos({ x: nx, y: ny });
  }, [x, y]);

  const visible = actions.filter((a) => !a.hideInRowMenu);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[200px] rounded-lg border border-gray-200 bg-white shadow-xl py-1"
      style={{ left: pos.x, top: pos.y }}
      role="menu"
    >
      <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 mb-1">
        {itemNoun} actions
      </div>
      {visible.map((a) => {
        const disabled = busy || !!(a.disabledForRow && a.disabledForRow(row));
        const reason = a.disabledForRow ? a.disabledForRow(row) : null;
        const cls =
          a.tone === "danger"
            ? "text-red-600 hover:bg-red-50"
            : a.tone === "primary"
              ? "text-brand-700 hover:bg-brand-50 font-medium"
              : "text-gray-800 hover:bg-gray-50";
        return (
          <button
            key={a.key}
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={() => onRun(a)}
            title={reason ?? undefined}
            className={`w-full text-left px-3 py-2 text-sm ${cls} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {busyKey === a.key ? (a.busyLabel ?? "Working…") : a.label}
            {reason && <span className="ml-2 text-xs text-gray-400">({reason})</span>}
          </button>
        );
      })}
    </div>
  );
}
