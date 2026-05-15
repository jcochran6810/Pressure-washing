"use client";

import { useState } from "react";
import { INCLUDED_BUSINESS_TYPES, BUSINESS_TYPE_ADDON_MONTHLY_PRICE, businessTypeAddonCost } from "@/lib/billing";

type Option = { id: string; name: string };

// Client-side checkbox grid + primary radio for the Settings → Business
// type section. Server action is wired via the parent <form action={...}>.
// The component just manages local UI state and renders hidden inputs that
// match what setBusinessTypes() expects.
export function BusinessTypesPicker({
  options,
  initialSelected,
  initialPrimary,
}: {
  options: Option[];
  initialSelected: string[];
  initialPrimary: string | null;
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [primary, setPrimary] = useState<string | null>(initialPrimary);

  function toggle(id: string) {
    setSelected((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      if (has && primary === id) {
        // If you uncheck the primary, the next remaining selection becomes primary.
        setPrimary(next[0] ?? null);
      } else if (!has && primary == null) {
        setPrimary(id);
      }
      return next;
    });
  }

  const extras = Math.max(0, selected.length - INCLUDED_BUSINESS_TYPES);
  const monthlyCost = businessTypeAddonCost(selected.length);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {options.map((b) => {
          const isSelected = selected.includes(b.id);
          const isPrimary = primary === b.id;
          return (
            <label
              key={b.id}
              className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer ${
                isSelected
                  ? isPrimary
                    ? "border-brand-500 bg-brand-50"
                    : "border-gray-300 bg-white"
                  : "border-gray-200 bg-gray-50 hover:bg-white"
              }`}
            >
              <input
                type="checkbox"
                name="business_type_id"
                value={b.id}
                checked={isSelected}
                onChange={() => toggle(b.id)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{b.name}</p>
                {isSelected && (
                  <label className="text-xs text-gray-600 mt-1 flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="primary_business_type_id"
                      value={b.id}
                      checked={isPrimary}
                      onChange={() => setPrimary(b.id)}
                    />
                    primary
                  </label>
                )}
              </div>
            </label>
          );
        })}
      </div>

      <div className="rounded-md p-3 text-xs mb-3 border bg-gray-50 border-gray-200">
        <p>
          <strong>{selected.length}</strong> trade{selected.length === 1 ? "" : "s"} selected.
        </p>
        {selected.length === 0 && (
          <p className="text-red-700 mt-1">Pick at least one trade.</p>
        )}
        {selected.length > 0 && selected.length <= INCLUDED_BUSINESS_TYPES && (
          <p className="text-green-700 mt-1">
            Included with your plan — first {INCLUDED_BUSINESS_TYPES} trades are free.
          </p>
        )}
        {extras > 0 && (
          <p className="text-amber-800 mt-1">
            {extras} additional trade{extras === 1 ? "" : "s"} × ${BUSINESS_TYPE_ADDON_MONTHLY_PRICE.toFixed(2)}/mo
            = <strong>+${monthlyCost.toFixed(2)}/mo</strong> add-on. Charged on your next bill.
          </p>
        )}
      </div>

      <button type="submit" className="btn-primary text-sm" disabled={selected.length === 0}>
        Save trades
      </button>
    </div>
  );
}
