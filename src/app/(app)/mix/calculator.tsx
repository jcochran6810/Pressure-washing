"use client";

import { useMemo, useState } from "react";

const PRESETS = [
  { name: "House wash (soft wash)", target: "1% SH on surface", sh: 6, surfactantOz: 4, label: "12.5% SH downstreamed at ~1:1.2" },
  { name: "Roof wash (asphalt)", target: "3.5% SH on surface", sh: 50, surfactantOz: 6, label: "12.5% SH 50:50 with water + surfactant" },
  { name: "Concrete cleaning", target: "0.5% SH on surface", sh: 3, surfactantOz: 4, label: "12.5% SH light prep mix" },
  { name: "Composite/wood (low %)", target: "0.5% SH on surface", sh: 2, surfactantOz: 6, label: "Gentle low-strength mix" },
];

const SURFACES: { name: string; sqft_per_gallon: number }[] = [
  { name: "House wash siding", sqft_per_gallon: 150 },
  { name: "Roof (asphalt shingle)", sqft_per_gallon: 80 },
  { name: "Concrete (driveway)", sqft_per_gallon: 200 },
  { name: "Composite/wood deck", sqft_per_gallon: 100 },
];

export function MixCalculator({ chemicals, recipes }: { chemicals: { id: string; name: string; unit: string }[]; recipes: any[] }) {
  const [shStock, setShStock] = useState(12.5); // strength of SH stock %
  const [targetPctSurface, setTargetPctSurface] = useState(1); // % SH on surface after dilution
  const [downstreamRatio, setDownstreamRatio] = useState(1.2); // downstream typically dilutes ~1.2:1
  const [batchGal, setBatchGal] = useState(5);
  const [surfactantOzPerGal, setSurfactantOzPerGal] = useState(4);
  const [areaSqft, setAreaSqft] = useState(2500);
  const [surface, setSurface] = useState(SURFACES[0]);

  // Surface % = (stock % × portion of stock) / (downstream dilution ratio + 1)
  // For dilution at the gun: actual % = mix% / (1 + ratio)
  const inMix = useMemo(() => targetPctSurface * (downstreamRatio + 1), [targetPctSurface, downstreamRatio]);
  const shFractionInMix = useMemo(() => Math.min(1, inMix / shStock), [inMix, shStock]);
  const shGallons = useMemo(() => batchGal * shFractionInMix, [batchGal, shFractionInMix]);
  const waterGallons = useMemo(() => batchGal - shGallons, [batchGal, shGallons]);
  const surfactantOz = useMemo(() => surfactantOzPerGal * batchGal, [surfactantOzPerGal, batchGal]);
  const coverageGal = useMemo(() => areaSqft / surface.sqft_per_gallon, [areaSqft, surface]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="card-padded space-y-3 lg:col-span-2">
        <h2 className="font-semibold">Mix inputs</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label>SH stock strength (%)</label>
            <input type="number" step="0.1" value={shStock} onChange={(e) => setShStock(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label>Target % SH on surface</label>
            <input type="number" step="0.1" value={targetPctSurface} onChange={(e) => setTargetPctSurface(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label>Downstream ratio (e.g. 1.2:1)</label>
            <input type="number" step="0.1" value={downstreamRatio} onChange={(e) => setDownstreamRatio(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label>Batch size (gallons)</label>
            <input type="number" step="0.5" min="0.5" value={batchGal} onChange={(e) => setBatchGal(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label>Surfactant (oz/gal)</label>
            <input type="number" step="0.5" min="0" value={surfactantOzPerGal} onChange={(e) => setSurfactantOzPerGal(Number(e.target.value))} className="w-full" />
          </div>
        </div>

        <h2 className="font-semibold mt-4">Coverage estimator</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label>Surface</label>
            <select value={surface.name} onChange={(e) => setSurface(SURFACES.find((s) => s.name === e.target.value) || SURFACES[0])} className="w-full">
              {SURFACES.map((s) => <option key={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label>Area (sqft)</label>
            <input type="number" min="0" value={areaSqft} onChange={(e) => setAreaSqft(Number(e.target.value))} className="w-full" />
          </div>
        </div>

        <h2 className="font-semibold mt-4">Quick presets</h2>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => { setTargetPctSurface(p.sh / 10); setSurfactantOzPerGal(p.surfactantOz); }}
              className="border border-gray-200 rounded-md p-2 text-left hover:bg-gray-50"
            >
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-gray-500">{p.target}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="card-padded">
        <h2 className="font-semibold mb-3">Result</h2>
        <Row label="SH (12.5%) in mix" value={`${shGallons.toFixed(2)} gal`} bold />
        <Row label="Water" value={`${Math.max(0, waterGallons).toFixed(2)} gal`} />
        <Row label="Surfactant" value={`${surfactantOz.toFixed(1)} oz`} />
        <Row label="% SH in tank" value={`${(shFractionInMix * shStock).toFixed(2)}%`} />
        <Row label="Effective % on surface" value={`${targetPctSurface}%`} muted />
        <div className="border-t border-gray-200 mt-3 pt-3">
          <Row label="Coverage need" value={`${coverageGal.toFixed(1)} gal mix`} bold />
          <Row label="Implied SH needed" value={`${(coverageGal * shFractionInMix).toFixed(2)} gal`} muted />
        </div>
      </div>

      {!!recipes.length && (
        <div className="card lg:col-span-3">
          <header className="px-4 py-3 border-b"><h2 className="font-semibold">Saved recipes</h2></header>
          <ul className="divide-y divide-gray-100">
            {recipes.map((r) => (
              <li key={r.id} className="px-4 py-2 text-sm flex justify-between">
                <span>{r.name}{r.target_surface ? ` · ${r.target_surface}` : ""}</span>
                <span className="text-gray-500 text-xs">{r.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between text-sm py-0.5 ${bold ? "font-semibold" : ""} ${muted ? "text-gray-500" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
