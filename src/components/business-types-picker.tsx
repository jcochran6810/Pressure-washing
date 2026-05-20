"use client";

import { useState } from "react";
import { INCLUDED_BUSINESS_TYPES, BUSINESS_TYPE_ADDON_MONTHLY_PRICE, businessTypeAddonCost } from "@/lib/billing";

type Option = { id: string; name: string };

// Client-side checkbox grid + primary radio for the Settings → Business
// type section. Server action is wired via the parent <form action={...}>.
// The component just manages local UI state and renders hidden inputs that
// match what setBusinessTypes() expects.
//
// Cancellation lifecycle: a trade marked `cancel_at_period_end` is still
// active until `dropsAt`. The user can re-enable it at no extra charge
// before that date by re-checking it (which clears the cancel flag).
export function BusinessTypesPicker({
  options,
  initialSelected,
  initialPrimary,
  pendingDrops = {},
}: {
  options: Option[];
  initialSelected: string[];
  initialPrimary: string | null;
  pendingDrops?: Record<string, string | null>; // id -> ISO drop date
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

  const initiallySelected = new Set(initialSelected);
  // How many extras the org WILL be billed for after this save?
  // - keep all that stay selected and were already paid for
  // - charge for newly added trades that push the count past the included floor
  const extras = Math.max(0, selected.length - INCLUDED_BUSINESS_TYPES);
  const monthlyCost = businessTypeAddonCost(selected.length);

  const removedThisSession = initialSelected.filter((id) => !selected.includes(id));
  const addedThisSession = selected.filter((id) => !initiallySelected.has(id));

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {options.map((b) => {
          const isSelected = selected.includes(b.id);
          const isPrimary = primary === b.id;
          const scheduledDrop = pendingDrops[b.id];
          const wasInitiallyOn = initiallySelected.has(b.id);
          const justAdded = isSelected && !wasInitiallyOn;
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
                {justAdded && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Available immediately. Charged on your next bill.
                  </p>
                )}
                {!isSelected && wasInitiallyOn && (
                  <p className="text-[11px] text-red-700 mt-1">
                    Scheduled to drop at the end of this billing cycle
                    {scheduledDrop ? ` (${formatDateShort(scheduledDrop)})` : ""}.
                    You'll keep access until then.
                  </p>
                )}
                {scheduledDrop && isSelected && (
                  <p className="text-[11px] text-green-700 mt-1">
                    Re-enabled — won't be dropped at the end of the cycle.
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>

      <div className="rounded-md p-3 text-xs mb-3 border bg-gray-50 border-gray-200 space-y-1">
        <p>
          <strong>{selected.length}</strong> trade{selected.length === 1 ? "" : "s"} selected.
        </p>
        {selected.length === 0 && (
          <p className="text-red-700">Pick at least one trade.</p>
        )}
        {selected.length > 0 && selected.length <= INCLUDED_BUSINESS_TYPES && (
          <p className="text-green-700">
            Included with your plan — first {INCLUDED_BUSINESS_TYPES} trades are free.
          </p>
        )}
        {extras > 0 && (
          <p className="text-amber-800">
            {extras} additional trade{extras === 1 ? "" : "s"} × ${BUSINESS_TYPE_ADDON_MONTHLY_PRICE.toFixed(2)}/mo
            = <strong>+${monthlyCost.toFixed(2)}/mo</strong> add-on. Charged on your next bill.
          </p>
        )}
        {addedThisSession.length > 0 && (
          <p className="text-blue-800">
            Adding {addedThisSession.length} trade{addedThisSession.length === 1 ? "" : "s"} — appears in
            estimate / invoice dropdowns immediately.
          </p>
        )}
        {removedThisSession.length > 0 && (
          <p className="text-gray-700">
            Cancelling {removedThisSession.length} trade{removedThisSession.length === 1 ? "" : "s"} —
            access stays on until the end of the current billing cycle, no further charges after.
          </p>
        )}
      </div>

      <button type="submit" className="btn-primary text-sm" disabled={selected.length === 0}>
        Save trades
      </button>
    </div>
  );
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
