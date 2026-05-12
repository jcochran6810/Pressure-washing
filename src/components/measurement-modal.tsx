"use client";

import { useEffect, useState } from "react";
import { MeasurementMap } from "./measurement-map";

type Polygon = { area_sqft: number };

export function MeasurementModal({
  apiKey,
  initialAddress,
  onConfirm,
  onClose,
}: {
  apiKey: string | null;
  initialAddress?: string;
  onConfirm: (sqft: number) => void;
  onClose: () => void;
}) {
  const [polys, setPolys] = useState<Polygon[]>([]);
  const totalSqft = polys.reduce((s, p) => s + (p.area_sqft || 0), 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-3xl sm:rounded-xl shadow-xl overflow-hidden flex flex-col max-h-screen sm:max-h-[90vh]">
        <header className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Measure area on satellite map</h2>
            <p className="text-xs text-gray-500">Draw the surface(s) to measure. Total square footage goes back to your line item.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 -mr-2 text-gray-500 hover:text-gray-700" aria-label="Close">✕</button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <MeasurementMap
            apiKey={apiKey}
            initialAddress={initialAddress}
            services={[]}
            hideFormFields
            compact
            onChange={(p) => setPolys(p.map((x) => ({ area_sqft: x.area_sqft })))}
          />
        </div>

        <footer className="px-4 py-3 border-t bg-gray-50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-gray-500">Total: </span>
            <strong className="text-lg">{Math.round(totalSqft).toLocaleString()}</strong>
            <span className="text-gray-500"> sqft</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              type="button"
              onClick={() => onConfirm(Math.round(totalSqft))}
              disabled={totalSqft <= 0}
              className="btn-primary"
            >
              Add to estimate ({Math.round(totalSqft).toLocaleString()} sqft)
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
