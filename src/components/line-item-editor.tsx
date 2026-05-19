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
// the left and one OR MORE material sub-rows on the right. All sub-rows
// in an entry share a single line_group uuid so the database can rebuild
// the group when the doc is re-opened for editing.
type Entry = {
  group: string;
  labor: SubLine;
  materials: SubLine[];
  // Per-line photos. Stored in the labor sub-row's photo_urls column on
  // save (or the first material if there's no labor). Showing them at
  // the entry level — not per sub-row — keeps the UI tidy when an entry
  // has labor + several materials but only one set of photos.
  photos: string[];
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
  photo_urls?: string[] | null;
};

function blankSub(): SubLine {
  return { description: "", quantity: 1, unit_price: 0, taxable: true };
}

function groupInitial(items: LineItemInit[]): Entry[] {
  if (!items.length)
    return [{ group: crypto.randomUUID(), labor: blankSub(), materials: [blankSub()], photos: [] }];
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
    const materials = rows.filter((r) => r.kind === "material");
    // Anything that isn't labor / material (legacy 'service' / 'other')
    // lands on the labor column as a single-sided entry.
    const other = rows.find((r) => r.kind !== "labor" && r.kind !== "material");
    const laborSrc = labor ?? other ?? null;
    // Gather photos from every row in the group + dedupe — schemas before
    // entry-level photos sometimes stored them on the material row.
    const photoSet = new Set<string>();
    for (const r of rows) for (const u of r.photo_urls ?? []) if (u) photoSet.add(u);
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
      materials: materials.length
        ? materials.map((m) => ({
            description: m.description,
            quantity: m.quantity,
            unit_price: m.unit_price,
            taxable: m.taxable,
          }))
        : [blankSub()],
      photos: Array.from(photoSet),
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
    initial?.length
      ? groupInitial(initial)
      : [{ group: crypto.randomUUID(), labor: blankSub(), materials: [blankSub()], photos: [] }],
  );
  // Tracks which entry index is mid-upload so we can show a spinner on its
  // "+ Add picture" button without disabling everyone else's.
  const [uploadingLineIdx, setUploadingLineIdx] = useState<number | null>(null);
  const [docPhotos, setDocPhotos] = useState<DocPhoto[]>(initialDocPhotos ?? []);
  const [taxRate, setTaxRate] = useState<number>(taxRateInitial ?? 0);
  const [discount, setDiscount] = useState<number>(discountInitial ?? 0);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [measuringIdx, setMeasuringIdx] = useState<
    | { entry: number; side: "labor" }
    | { entry: number; side: "material"; materialIndex: number }
    | null
  >(null);
  const supabase = useRef(createClient()).current;

  function updateLabor(i: number, patch: Partial<SubLine>) {
    setEntries((arr) =>
      arr.map((e, idx) => (idx === i ? { ...e, labor: { ...e.labor, ...patch } } : e)),
    );
  }
  function updateMaterial(i: number, mIdx: number, patch: Partial<SubLine>) {
    setEntries((arr) =>
      arr.map((e, idx) =>
        idx === i
          ? { ...e, materials: e.materials.map((m, j) => (j === mIdx ? { ...m, ...patch } : m)) }
          : e,
      ),
    );
  }
  function addMaterial(i: number) {
    setEntries((arr) =>
      arr.map((e, idx) => (idx === i ? { ...e, materials: [...e.materials, blankSub()] } : e)),
    );
  }
  function removeMaterial(i: number, mIdx: number) {
    setEntries((arr) =>
      arr.map((e, idx) =>
        idx === i
          ? {
              ...e,
              // Keep at least one material card visible (blank is fine) so the
              // entry still has a material column to type into.
              materials:
                e.materials.length > 1 ? e.materials.filter((_, j) => j !== mIdx) : [blankSub()],
            }
          : e,
      ),
    );
  }
  function removeEntry(i: number) {
    setEntries((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));
  }
  function addEntry() {
    setEntries((arr) => [
      ...arr,
      { group: crypto.randomUUID(), labor: blankSub(), materials: [blankSub()], photos: [] },
    ]);
  }

  async function handleLinePhotos(i: number, files: FileList | null) {
    if (!files?.length) return;
    setUploadingLineIdx(i);
    setPhotoErr(null);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${organizationId}/line-items/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("photos").upload(path, file);
      if (upErr) {
        setPhotoErr(upErr.message);
        setUploadingLineIdx(null);
        return;
      }
      const { data: signed } = await supabase.storage.from("photos").createSignedUrl(path, 60 * 60 * 24 * 365);
      newUrls.push(signed?.signedUrl ?? path);
    }
    setEntries((arr) =>
      arr.map((e, idx) => (idx === i ? { ...e, photos: [...e.photos, ...newUrls] } : e)),
    );
    setUploadingLineIdx(null);
  }
  function removeLinePhoto(i: number, url: string) {
    setEntries((arr) =>
      arr.map((e, idx) => (idx === i ? { ...e, photos: e.photos.filter((u) => u !== url) } : e)),
    );
  }
  function applyService(
    i: number,
    target: { side: "labor" } | { side: "material"; materialIndex: number },
    serviceId: string,
  ) {
    const s = services.find((x) => x.id === serviceId);
    if (!s) return;
    // If the service has a default_kind, route it to the matching side so
    // picking a labor service on the material column moves it across.
    const wantsLabor = s.default_kind === "labor";
    const wantsMaterial = s.default_kind === "material";
    const finalSide: "labor" | "material" = wantsLabor
      ? "labor"
      : wantsMaterial
        ? "material"
        : target.side;
    if (finalSide === "labor") {
      updateLabor(i, {
        description: s.name,
        unit_price: Number(s.default_price ?? 0),
        taxable: typeof s.default_taxable === "boolean" ? s.default_taxable : entries[i].labor.taxable,
      });
    } else {
      // Apply onto the material card the user was looking at when they
      // picked a service, even if it was a labor-typed service rerouted
      // here from the labor column.
      const mIdx = target.side === "material" ? target.materialIndex : 0;
      updateMaterial(i, mIdx, {
        description: s.name,
        unit_price: Number(s.default_price ?? 0),
        taxable:
          typeof s.default_taxable === "boolean"
            ? s.default_taxable
            : entries[i].materials[mIdx]?.taxable ?? true,
      });
    }
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
    if (e.labor.description.trim()) {
      out.push({ line: lineTotal(e.labor), taxable: e.labor.taxable, kind: "labor" });
    }
    for (const m of e.materials) {
      if (m.description.trim()) {
        out.push({ line: lineTotal(m), taxable: m.taxable, kind: "material" });
      }
    }
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

  function entryTotal(e: Entry) {
    let t = lineTotal(e.labor);
    for (const m of e.materials) t += lineTotal(m);
    return t;
  }

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
              if (cur.side === "labor") {
                updateLabor(cur.entry, { quantity: sqft });
                if (!entries[cur.entry].labor.description.trim()) {
                  updateLabor(cur.entry, { description: `${sqft.toLocaleString()} sqft area` });
                }
              } else {
                const mIdx = cur.materialIndex;
                updateMaterial(cur.entry, mIdx, { quantity: sqft });
                if (!entries[cur.entry].materials[mIdx]?.description.trim()) {
                  updateMaterial(cur.entry, mIdx, { description: `${sqft.toLocaleString()} sqft area` });
                }
              }
            }
            setMeasuringIdx(null);
          }}
        />
      )}

      <div className="space-y-3">
        {entries.map((entry, i) => {
          const laborServices = services.filter((s) => (s.default_kind ?? "service") !== "material");
          const materialServices = services.filter((s) => (s.default_kind ?? "service") !== "labor");
          return (
            <div key={entry.group} className="border border-gray-200 rounded-md p-2.5 space-y-2">
              {/* Hidden marker: one per entry so the server knows how many
                  rows to read. Group id lets us re-pair on edit. */}
              <input type="hidden" name="li_group" value={entry.group} />
              {/* Labor side serialized as plain hidden fields. */}
              <input type="hidden" name="labor_description" value={entry.labor.description} />
              <input type="hidden" name="labor_quantity" value={entry.labor.quantity} />
              <input type="hidden" name="labor_unit_price" value={entry.labor.unit_price} />
              <input
                type="hidden"
                name="labor_taxable_marker"
                value={entry.labor.taxable ? "checked" : "unchecked"}
              />
              {/* All material sub-rows for this entry JSON-encoded as one
                  field so we can ship a variable count cleanly. */}
              <input
                type="hidden"
                name="entry_materials"
                value={JSON.stringify(
                  entry.materials.map((m) => ({
                    description: m.description,
                    quantity: m.quantity,
                    unit_price: m.unit_price,
                    taxable: m.taxable,
                  })),
                )}
              />
              {/* Per-line photos JSON-encoded so the action can attach them
                  to the entry's first persisted row. */}
              <input type="hidden" name="entry_photos" value={JSON.stringify(entry.photos)} />

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
                  services={laborServices}
                  onChange={(patch) => updateLabor(i, patch)}
                  onPickService={(id) => applyService(i, { side: "labor" }, id)}
                  onMeasure={() => setMeasuringIdx({ entry: i, side: "labor" })}
                  total={lineTotal(entry.labor)}
                />
                <div className="space-y-2">
                  {entry.materials.map((m, mIdx) => (
                    <SubLineCard
                      key={mIdx}
                      title={mIdx === 0 ? "Material" : `Material ${mIdx + 1}`}
                      accent="green"
                      value={m}
                      services={materialServices}
                      onChange={(patch) => updateMaterial(i, mIdx, patch)}
                      onPickService={(id) => applyService(i, { side: "material", materialIndex: mIdx }, id)}
                      onMeasure={() => setMeasuringIdx({ entry: i, side: "material", materialIndex: mIdx })}
                      total={lineTotal(m)}
                      onRemove={entry.materials.length > 1 ? () => removeMaterial(i, mIdx) : undefined}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => addMaterial(i)}
                    className="text-xs text-green-700 hover:text-green-900 hover:underline"
                  >
                    + Additional material
                  </button>
                </div>
              </div>

              {entry.photos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {entry.photos.map((url) => (
                    <div key={url} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-14 h-14 object-cover rounded border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => removeLinePhoto(i, url)}
                        className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-4 h-4 rounded-full leading-none opacity-0 group-hover:opacity-100"
                        aria-label="Remove photo"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                <label className="text-xs text-brand-600 hover:underline cursor-pointer">
                  {uploadingLineIdx === i ? "Uploading…" : "+ Add picture to this line"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={(e) => handleLinePhotos(i, e.target.files)}
                    disabled={uploadingLineIdx !== null}
                    className="hidden"
                  />
                </label>
                <span className="text-sm font-medium">
                  Line total: {formatCurrency(entryTotal(entry))}
                </span>
              </div>
            </div>
          );
        })}

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
  onRemove,
}: {
  title: string;
  accent: "blue" | "green";
  value: SubLine;
  services: Service[];
  onChange: (patch: Partial<SubLine>) => void;
  onPickService: (id: string) => void;
  onMeasure: () => void;
  total: number;
  // When set, shows an "×" in the card header to drop this sub-row.
  // Used by additional material cards (the first material card hides it).
  onRemove?: () => void;
}) {
  const borderTone = accent === "blue" ? "border-blue-200 bg-blue-50/30" : "border-green-200 bg-green-50/30";
  const labelTone = accent === "blue" ? "text-blue-700" : "text-green-700";
  return (
    <div className={`rounded-md border ${borderTone} p-2.5 space-y-2`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wider ${labelTone}`}>{title}</p>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{formatCurrency(total)}</p>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${title}`}
              className="text-gray-400 hover:text-red-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <input
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
