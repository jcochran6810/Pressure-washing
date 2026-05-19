"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { MeasurementModal } from "./measurement-modal";

export type LineKind = "labor" | "material" | "service" | "other";

// One side of a paired entry. Either side may be empty (description blank);
// blank sides aren't persisted as line_items rows on save.
type SubLine = {
  description: string;
  quantity: number;
  unit_price: number;
  taxable: boolean;
};

// A paired entry = one shared row in the editor with a labor sub-row on
// the left and a material sub-row on the right. Both sub-rows share a
// line_group uuid so the database can rebuild the pair on edit.
type Entry = {
  group: string;
  labor: SubLine;
  material: SubLine;
  // Per-line photos are still supported by the schema (photo_urls on each
  // line item) but we no longer surface them here — pictures attach at
  // the document level instead (DocPhoto below).
};

type Service = {
  id: string;
  name: string;
  default_price: number | null;
  default_kind?: LineKind | null;
  default_taxable?: boolean | null;
};

type DocPhoto = { url: string; note: string };

// When loading existing line_items rows on the edit page, we group them
// by line_group so the editor re-renders paired rows correctly.
export type LineItemInit = {
  description: string;
  quantity: number;
  unit_price: number;
  kind: LineKind;
  taxable: boolean;
  line_group?: string | null;
};

function blankSub(): SubLine {
  return { description: "", quantity: 1, unit_price: 0, taxable: true };
}

function groupInitial(items: LineItemInit[]): Entry[] {
  if (!items.length) return [{ group: crypto.randomUUID(), labor: blankSub(), material: blankSub() }];
  // Bucket by line_group, then process buckets in encountered order.
  const buckets = new Map<string, LineItemInit[]>();
  const seen: string[] = [];
  for (const it of items) {
    const key = it.line_group ?? `solo-${seen.length}-${it.kind}-${it.description}`;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      seen.push(key);
    }
    buckets.get(key)!.push(it);
  }
  return seen.map((key) => {
    const rows = buckets.get(key)!;
    const labor = rows.find((r) => r.kind === "labor");
    const material = rows.find((r) => r.kind === "material");
    // Anything that isn't labor / material (legacy 'service' / 'other')
    // lands on the labor column as a single-sided entry.
    const other = rows.find((r) => r.kind !== "labor" && r.kind !== "material");
    const laborSrc = labor ?? other ?? null;
    return {
      group: key.startsWith("solo-") ? crypto.randomUUID() : key,
      labor: laborSrc
        ? {
            description: laborSrc.description,
            quantity: laborSrc.quantity,
            unit_price: laborSrc.unit_price,
            taxable: laborSrc.taxable,
          }
        : blankSub(),
      material: material
        ? {
            description: material.description,
            quantity: material.quantity,
            unit_price: material.unit_price,
            taxable: material.taxable,
          }
        : blankSub(),
    };
  });
}

export function LineItemEditor({
  services,
  initial,
  initialDocPhotos,
  taxRateInitial,
  discountInitial,
  organizationId,
  mapsApiKey,
  initialAddress,
}: {
  services: Service[];
  initial?: LineItemInit[];
  initialDocPhotos?: DocPhoto[];
  taxRateInitial?: number;
  discountInitial?: number;
  organizationId: string;
  mapsApiKey?: string | null;
  initialAddress?: string;
}) {
  const [entries, setEntries] = useState<Entry[]>(
    initial?.length ? groupInitial(initial) : [{ group: crypto.randomUUID(), labor: blankSub(), material: blankSub() }],
  );
  const [docPhotos, setDocPhotos] = useState<DocPhoto[]>(initialDocPhotos ?? []);
  const [taxRate, setTaxRate] = useState<number>(taxRateInitial ?? 0);
  const [discount, setDiscount] = useState<number>(discountInitial ?? 0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [measuringIdx, setMeasuringIdx] = useState<{ entry: number; side: "labor" | "material" } | null>(null);
  const supabase = useRef(createClient()).current;

  function updateSub(i: number, side: "labor" | "material", patch: Partial<SubLine>) {
    setEntries((arr) =>
      arr.map((e, idx) => (idx === i ? { ...e, [side]: { ...e[side], ...patch } } : e)),
    );
  }
  function removeEntry(i: number) {
    setEntries((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));
  }
  function addEntry() {
    setEntries((arr) => [...arr, { group: crypto.randomUUID(), labor: blankSub(), material: blankSub() }]);
  }
  function applyService(i: number, side: "labor" | "material", serviceId: string) {
    const s = services.find((x) => x.id === serviceId);
    if (!s) return;
    // If the service has a default_kind, route it to the matching side so
    // picking a labor service on the material column moves it across.
    const targetSide: "labor" | "material" =
      s.default_kind === "material" ? "material" : s.default_kind === "labor" ? "labor" : side;
    updateSub(i, targetSide, {
      description: s.name,
      unit_price: Number(s.default_price ?? 0),
      taxable: typeof s.default_taxable === "boolean" ? s.default_taxable : entries[i][targetSide].taxable,
    });
  }

  async function handleDocPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploadingPhoto(true);
    setPhotoErr(null);
    const newOnes: DocPhoto[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${organizationId}/doc-photos/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("photos").upload(path, file);
      if (upErr) {
        setPhotoErr(upErr.message);
        setUploadingPhoto(false);
        return;
      }
      const { data: signed } = await supabase.storage.from("photos").createSignedUrl(path, 60 * 60 * 24 * 365);
      newOnes.push({ url: signed?.signedUrl ?? path, note: "" });
    }
    setDocPhotos((arr) => [...arr, ...newOnes]);
    setUploadingPhoto(false);
  }

  function updatePhotoNote(idx: number, note: string) {
    setDocPhotos((arr) => arr.map((p, i) => (i === idx ? { ...p, note } : p)));
  }
  function removePhoto(idx: number) {
    setDocPhotos((arr) => arr.filter((_, i) => i !== idx));
  }

  function lineTotal(s: SubLine) {
    return (Number(s.quantity) || 0) * (Number(s.unit_price) || 0);
  }

  // Mirror the server-side rollup math so the running totals match what
  // gets persisted exactly.
  const allSubs = entries.flatMap((e) => {
    const out: { line: number; taxable: boolean; kind: LineKind }[] = [];
    if (e.labor.description.trim()) out.push({ line: lineTotal(e.labor), taxable: e.labor.taxable, kind: "labor" });
    if (e.material.description.trim()) out.push({ line: lineTotal(e.material), taxable: e.material.taxable, kind: "material" });
    return out;
  });
  const subtotal = allSubs.reduce((s, l) => s + l.line, 0);
  const taxableRaw = allSubs.reduce((s, l) => s + (l.taxable ? l.line : 0), 0);
  const taxablePortion = subtotal > 0 ? (taxableRaw / subtotal) * (Number(discount) || 0) : 0;
  const taxBase = Math.max(0, taxableRaw - taxablePortion);
  const taxAmount = taxBase * (Number(taxRate) || 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0)) + taxAmount;
  const laborTotal = allSubs.reduce((s, l) => s + (l.kind === "labor" ? l.line : 0), 0);
  const materialsTotal = allSubs.reduce((s, l) => s + (l.kind === "material" ? l.line : 0), 0);
  const hasMixedKinds = laborTotal > 0 && materialsTotal > 0;

  return (
    <div className="space-y-3">
      {measuringIdx !== null && (
        <MeasurementModal
          apiKey={mapsApiKey ?? null}
          initialAddress={initialAddress}
          onClose={() => setMeasuringIdx(null)}
          onConfirm={(sqft) => {
            const cur = measuringIdx;
            if (cur && sqft > 0) {
              updateSub(cur.entry, cur.side, { quantity: sqft });
              if (!entries[cur.entry][cur.side].description.trim()) {
                updateSub(cur.entry, cur.side, { description: `${sqft.toLocaleString()} sqft area` });
              }
            }
            setMeasuringIdx(null);
          }}
        />
      )}

      <div className="space-y-3">
        {entries.map((entry, i) => (
          <div key={entry.group} className="border border-gray-200 rounded-md p-2.5 space-y-2">
            {/* Hidden marker: one per entry so the server knows how many
                pairs to read. Group id lets us re-pair on edit. */}
            <input type="hidden" name="li_group" value={entry.group} />
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-gray-500">Line {i + 1}</p>
              <button
                type="button"
                onClick={() => removeEntry(i)}
                className="text-gray-400 hover:text-red-600 text-sm"
                disabled={entries.length <= 1}
              >
                ✕ Remove line
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <SubLineCard
                title="Labor"
                accent="blue"
                value={entry.labor}
                services={services.filter((s) => (s.default_kind ?? "service") !== "material")}
                onChange={(patch) => updateSub(i, "labor", patch)}
                onPickService={(id) => applyService(i, "labor", id)}
                onMeasure={() => setMeasuringIdx({ entry: i, side: "labor" })}
                total={lineTotal(entry.labor)}
                fieldPrefix="labor"
              />
              <SubLineCard
                title="Material"
                accent="green"
                value={entry.material}
                services={services.filter((s) => (s.default_kind ?? "service") !== "labor")}
                onChange={(patch) => updateSub(i, "material", patch)}
                onPickService={(id) => applyService(i, "material", id)}
                onMeasure={() => setMeasuringIdx({ entry: i, side: "material" })}
                total={lineTotal(entry.material)}
                fieldPrefix="material"
              />
            </div>

            <div className="text-right text-sm font-medium pt-1 border-t border-gray-100">
              Line total: {formatCurrency(lineTotal(entry.labor) + lineTotal(entry.material))}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={addEntry} className="btn-secondary text-sm">+ Add line</button>
          <label className="btn-secondary text-sm cursor-pointer">
            {uploadingPhoto ? "Uploading…" : "+ Add picture"}
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={(e) => handleDocPhotos(e.target.files)}
              disabled={uploadingPhoto}
              className="hidden"
            />
          </label>
        </div>
        {photoErr && <p className="text-xs text-red-600">{photoErr}</p>}
      </div>

      {docPhotos.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700">Pictures ({docPhotos.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {docPhotos.map((p, idx) => (
              <PhotoCard
                key={p.url}
                photo={p}
                onNote={(note) => updatePhotoNote(idx, note)}
                onRemove={() => removePhoto(idx)}
              />
            ))}
          </div>
          {/* Serialize doc photos as parallel arrays for the form action. */}
          {docPhotos.map((p, idx) => (
            <span key={`hidden-${idx}`}>
              <input type="hidden" name="doc_photo_url" value={p.url} />
              <input type="hidden" name="doc_photo_note" value={p.note} />
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-200">
        <div className="space-y-2">
          <div>
            <label>Discount ($)</label>
            <input
              name="discount_amount"
              type="number"
              step="0.01"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label>Tax rate (e.g. 0.0825 for 8.25%)</label>
            <input
              name="tax_rate"
              type="number"
              step="0.0001"
              min="0"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
        <div className="card-padded">
          <Row label="Subtotal" value={formatCurrency(subtotal)} />
          {hasMixedKinds && (
            <>
              <Row label="  • Labor" value={formatCurrency(laborTotal)} dim />
              <Row label="  • Materials" value={formatCurrency(materialsTotal)} dim />
            </>
          )}
          <Row label="Discount" value={`− ${formatCurrency(discount)}`} />
          <Row label="Taxable subtotal" value={formatCurrency(taxBase)} dim />
          <Row label={`Tax (${(taxRate * 100).toFixed(2)}%)`} value={formatCurrency(taxAmount)} />
          <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubLineCard({
  title,
  accent,
  value,
  services,
  onChange,
  onPickService,
  onMeasure,
  total,
  fieldPrefix,
}: {
  title: string;
  accent: "blue" | "green";
  value: SubLine;
  services: Service[];
  onChange: (patch: Partial<SubLine>) => void;
  onPickService: (id: string) => void;
  onMeasure: () => void;
  total: number;
  fieldPrefix: "labor" | "material";
}) {
  const borderTone = accent === "blue" ? "border-blue-200 bg-blue-50/30" : "border-green-200 bg-green-50/30";
  const labelTone = accent === "blue" ? "text-blue-700" : "text-green-700";
  return (
    <div className={`rounded-md border ${borderTone} p-2.5 space-y-2`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wider ${labelTone}`}>{title}</p>
        <p className="text-sm font-medium">{formatCurrency(total)}</p>
      </div>
      <input
        name={`${fieldPrefix}_description`}
        value={value.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder={title === "Labor" ? "e.g. House wash" : "e.g. Bleach gallon"}
        className="w-full text-sm"
      />
      {!!services.length && (
        <select
          onChange={(e) => { onPickService(e.target.value); e.target.value = ""; }}
          className="w-full text-xs"
          defaultValue=""
        >
          <option value="">— Add from catalog —</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {s.default_price ? `(${formatCurrency(Number(s.default_price))})` : ""}
            </option>
          ))}
        </select>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <input
            name={`${fieldPrefix}_quantity`}
            type="number"
            step="0.01"
            min="0"
            value={value.quantity}
            onChange={(e) => onChange({ quantity: Number(e.target.value) })}
            className="w-full text-sm"
          />
          <p className="text-[10px] text-gray-500 mt-0.5 text-center">Quantity</p>
        </div>
        <div>
          <input
            name={`${fieldPrefix}_unit_price`}
            type="number"
            step="0.01"
            min="0"
            value={value.unit_price}
            onChange={(e) => onChange({ unit_price: Number(e.target.value) })}
            className="w-full text-sm"
          />
          <p className="text-[10px] text-gray-500 mt-0.5 text-center">Amount</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={value.taxable}
            onChange={(e) => onChange({ taxable: e.target.checked })}
          />
          <span>Tax</span>
        </label>
        <input
          type="hidden"
          name={`${fieldPrefix}_taxable_marker`}
          value={value.taxable ? "checked" : "unchecked"}
        />
        <button type="button" onClick={onMeasure} className="text-brand-600 hover:underline">
          + Measure
        </button>
      </div>
    </div>
  );
}

function PhotoCard({
  photo,
  onNote,
  onRemove,
}: {
  photo: DocPhoto;
  onNote: (n: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(!!photo.note);
  return (
    <div className="border border-gray-200 rounded-md p-2 flex gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt="" className="w-24 h-24 object-cover rounded border border-gray-200 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {editing ? (
          <textarea
            rows={3}
            value={photo.note}
            onChange={(e) => onNote(e.target.value)}
            onBlur={() => { if (!photo.note.trim()) setEditing(false); }}
            placeholder="Add a note about this picture…"
            className="w-full text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-brand-600 hover:underline"
          >
            + Add notes
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="block mt-1 text-[11px] text-gray-400 hover:text-red-600"
        >
          Remove picture
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className={"flex justify-between text-sm py-0.5 " + (dim ? "text-gray-500" : "")}>
      <span className={dim ? "" : "text-gray-500"}>{label}</span>
      <span className={dim ? "" : "font-medium"}>{value}</span>
    </div>
  );
}
