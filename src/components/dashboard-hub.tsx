"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, type NavGroup } from "@/components/nav-config";

export function DashboardHub({ initialAllOpen = false }: { initialAllOpen?: boolean }) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(initialAllOpen ? NAV_GROUPS.map((g) => g.key) : []),
  );

  function toggle(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const allOpen = openGroups.size === NAV_GROUPS.length;

  function expandAll() {
    setOpenGroups(new Set(NAV_GROUPS.map((g) => g.key)));
  }
  function collapseAll() {
    setOpenGroups(new Set());
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-end mb-2">
        <button
          type="button"
          onClick={allOpen ? collapseAll : expandAll}
          className="text-xs text-brand-600 hover:text-brand-700 font-medium"
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <ul className="space-y-2">
        {NAV_GROUPS.map((g) => (
          <HubCard
            key={g.key}
            group={g}
            open={openGroups.has(g.key)}
            onToggle={() => toggle(g.key)}
          />
        ))}
      </ul>
    </section>
  );
}

function HubCard({ group, open, onToggle }: { group: NavGroup; open: boolean; onToggle: () => void }) {
  return (
    <li className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50"
      >
        <HubIconTile>{group.icon}</HubIconTile>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-gray-900 truncate">{group.label}</span>
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={cn("text-gray-400 transition-transform", open ? "rotate-180" : "rotate-0")}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <ul className="px-4 pb-3 pt-1 space-y-0.5 border-t border-gray-100">
          {group.children.map((c, idx) => (
            <li key={`${c.label}-${idx}`}>
              <Link
                href={c.href}
                className="flex items-center gap-2.5 pl-2 pr-2 py-2 rounded-md text-[15px] text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                <span className="flex-1">{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function HubIconTile({ children }: { children: ReactNode }) {
  return (
    <span className="w-11 h-11 rounded-xl grid place-items-center bg-brand-50 text-brand-600 shrink-0">
      {children}
    </span>
  );
}
