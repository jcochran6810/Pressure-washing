"use client";

import { useEffect, useMemo, useState } from "react";

type Chemical = { id: string; name: string; unit: string | null; category?: string | null };

const PRESETS = [
  { name: "House wash (soft wash)", target: "1% SH on surface", sh: 1.0, surfactantOz: 4, label: "12.5% SH downstreamed at ~1:1.2" },
  { name: "Roof wash (asphalt)", target: "3.5% SH on surface", sh: 3.5, surfactantOz: 6, label: "12.5% SH 50:50 with water + surfactant" },
  { name: "Concrete cleaning", target: "0.5% SH on surface", sh: 0.5, surfactantOz: 4, label: "12.5% SH light prep mix" },
  { name: "Composite/wood (low %)", target: "0.5% SH on surface", sh: 0.5, surfactantOz: 6, label: "Gentle low-strength mix" },
];

const SURFACES: { name: string; sqft_per_gallon: number }[] = [
  { name: "House wash siding", sqft_per_gallon: 150 },
  { name: "Roof (asphalt shingle)", sqft_per_gallon: 80 },
  { name: "Concrete (driveway)", sqft_per_gallon: 200 },
  { name: "Composite/wood deck", sqft_per_gallon: 100 },
];

// Try to read a percentage from a chemical name like "Sodium Hypochlorite 12.5%"
function parseStrength(name: string): number | null {
  const m = name.match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : null;
}

function categorize(c: Chemical): "oxidizer" | "surfactant" | "other" {
  const cat = (c.category || "").toLowerCase();
  const name = c.name.toLowerCase();
  if (cat.includes("oxidizer") || name.includes("hypochlorite") || name.includes("sh ")) return "oxidizer";
  if (cat.includes("surfactant") || name.includes("surfactant") || name.includes("foam")) return "surfactant";
  return "other";
}

export function MixCalculator({ chemicals, recipes }: { chemicals: Chemical[]; recipes: any[] }) {
  const oxidizers = useMemo(() => chemicals.filter((c) => categorize(c) === "oxidizer"), [chemicals]);
  const surfactants = useMemo(() => chemicals.filter((c) => categorize(c) === "surfactant"), [chemicals]);

  // Default to the first oxidizer with a percent in its name
  const defaultOxidizer = oxidizers.find((c) => parseStrength(c.name) != null) ?? oxidizers[0];
  const defaultSurfactant = surfactants[0];

  const [oxidizerId, setOxidizerId] = useState<string>(defaultOxidizer?.id ?? "");
  const [surfactantId, setSurfactantId] = useState<string>(defaultSurfactant?.id ?? "");

  const oxidizerObj = oxidizers.find((c) => c.id === oxidizerId);
  const surfactantObj = surfactants.find((c) => c.id === surfactantId);

  const [shStock, setShStock] = useState<number>(parseStrength(defaultOxidizer?.name ?? "") ?? 12.5);
  const [targetPctSurface, setTargetPctSurface] = useState(1);
  const [downstreamRatio, setDownstreamRatio] = useState(1.2);
  const [batchGal, setBatchGal] = useState(5);
  const [surfactantOzPerGal, setSurfactantOzPerGal] = useState(4);
  const [areaSqft, setAreaSqft] = useState(2500);
  const [surface, setSurface] = useState(SURFACES[0]);

  // When the user picks a different oxidizer, auto-fill the stock strength from its name (if present)
  useEffect(() => {
    if (!oxidizerObj) return;
    const parsed = parseStrength(oxidizerObj.name);
    if (parsed != null) setShStock(parsed);
  }, [oxidizerObj]);

  const inMix = useMemo(() => targetPctSurface * (downstreamRatio + 1), [targetPctSurface, downstreamRatio]);
  const shFractionInMix = useMemo(() => Math.min(1, inMix / shStock), [inMix, shStock]);
  const shGallons = useMemo(() => batchGal * shFractionInMix, [batchGal, shFractionInMix]);
  const waterGallons = useMemo(() => batchGal - shGallons, [batchGal, shGallons]);
  const surfactantOz = useMemo(() => surfactantOzPerGal * batchGal, [surfactantOzPerGal, batchGal]);
  const coverageGal = useMemo(() => areaSqft / surface.sqft_per_gallon, [areaSqft, surface]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="card-padded space-y-3 lg:col-span-2">
        <h2 className="font-semibold">Chemicals from your inventory</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label>SH / Oxidizer</label>
            <select value={oxidizerId} onChange={(e) => setOxidizerId(e.target.value)} className="w-full">
              <option value="">— Select a chemical —</option>
              {oxidizers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {oxidizerObj && parseStrength(oxidizerObj.name) != null
                ? `Auto-filled stock strength: ${parseStrength(oxidizerObj.name)}%`
                : "No % in name — enter the stock strength manually below."}
            </p>
          </div>
          <div>
            <label>Surfactant</label>
            <select value={surfactantId} onChange={(e) => setSurfactantId(e.target.value)} className="w-full">
              <option value="">— Select a chemical —</option>
              {surfactants.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {surfactantObj ? "Using: " + surfactantObj.name : "Optional — choose a surfactant for the mix"}
            </p>
          </div>
        </div>

        <h2 className="font-semibold mt-2">Mix inputs</h2>
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
              onClick={() => { setTargetPctSurface(p.sh); setSurfactantOzPerGal(p.surfactantOz); }}
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
        <Row label={oxidizerObj?.name ?? "SH"} value={`${shGallons.toFixed(2)} gal`} bold />
        <Row label="Water" value={`${Math.max(0, waterGallons).toFixed(2)} gal`} />
        <Row label={surfactantObj?.name ?? "Surfactant"} value={`${surfactantOz.toFixed(1)} oz`} />
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
      <span className="truncate pr-2">{label}</span>
      <span className="whitespace-nowrap">{value}</span>
    </div>
  );
}
