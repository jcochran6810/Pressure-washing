"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";

type Item = { description: string; quantity: number; unit_price: number; photos: string[] };
type Service = { id: string; name: string; default_price: number | null };

export function LineItemEditor({
  services,
  initial,
  taxRateInitial,
  discountInitial,
  organizationId,
}: {
  services: Service[];
  initial?: Item[];
  taxRateInitial?: number;
  discountInitial?: number;
  organizationId: string;
}) {
  const [items, setItems] = useState<Item[]>(initial?.length ? initial : [{ description: "", quantity: 1, unit_price: 0, photos: [] }]);
  const [taxRate, setTaxRate] = useState<number>(taxRateInitial ?? 0);
  const [discount, setDiscount] = useState<number>(discountInitial ?? 0);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const supabase = useRef(createClient()).current;

  function update(i: number, patch: Partial<Item>) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function remove(i: number) {
    setItems((arr) => arr.filter((_, idx) => idx !== i));
  }
  function add() {
    setItems((arr) => [...arr, { description: "", quantity: 1, unit_price: 0, photos: [] }]);
  }
  function applyService(i: number, serviceId: string) {
    const s = services.find((x) => x.id === serviceId);
    if (!s) return;
    update(i, { description: s.name, unit_price: Number(s.default_price ?? 0) });
  }

  async function handleFiles(i: number, files: FileList | null) {
    if (!files?.length) return;
    setUploadingIdx(i);
    setUploadErr(null);
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${organizationId}/line-items/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("photos").upload(path, file);
      if (upErr) {
        setUploadErr(upErr.message);
        setUploadingIdx(null);
        return;
      }
      const { data: signed } = await supabase.storage.from("photos").createSignedUrl(path, 60 * 60 * 24 * 365);
      newUrls.push(signed?.signedUrl ?? path);
    }
    update(i, { photos: [...items[i].photos, ...newUrls] });
    setUploadingIdx(null);
  }

  function removePhoto(i: number, url: string) {
    update(i, { photos: items[i].photos.filter((u) => u !== url) });
  }

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
  const taxBase = Math.max(0, subtotal - (Number(discount) || 0));
  const taxAmount = taxBase * (Number(taxRate) || 0);
  const total = taxBase + taxAmount;

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="border border-gray-200 rounded-md p-2.5 space-y-2">
            <div className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-12 sm:col-span-5">
                <input
                  name="li_description"
                  value={it.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  placeholder="Description (e.g. House wash)"
                  className="w-full"
                />
                {!!services.length && (
                  <select
                    onChange={(e) => { applyService(i, e.target.value); e.target.value = ""; }}
                    className="w-full mt-1 text-xs"
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
              </div>
              <div className="col-span-3 sm:col-span-2">
                <input
                  name="li_quantity"
                  type="number"
                  step="0.01"
                  min="0"
                  value={it.quantity}
                  onChange={(e) => update(i, { quantity: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input
                  name="li_unit_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={it.unit_price}
                  onChange={(e) => update(i, { unit_price: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div className="col-span-3 sm:col-span-2 text-right pt-2 text-sm font-medium">
                {formatCurrency((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}
              </div>
              <div className="col-span-2 sm:col-span-1 pt-1 text-right">
                <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-600 text-sm">✕</button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="btn-ghost text-xs cursor-pointer">
                {uploadingIdx === i ? "Uploading…" : "+ Add picture"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={(e) => handleFiles(i, e.target.files)}
                  disabled={uploadingIdx !== null}
                  className="hidden"
                />
              </label>
              {it.photos.map((url) => (
                <div key={url} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-14 h-14 object-cover rounded border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i, url)}
                    className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-4 h-4 rounded-full leading-none opacity-0 group-hover:opacity-100"
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {/* Photo URLs travel with the form as one JSON string per item */}
              <input type="hidden" name="li_photos" value={JSON.stringify(it.photos)} />
            </div>
          </div>
        ))}
        <button type="button" onClick={add} className="btn-secondary text-sm">+ Add line</button>
        {uploadErr && <p className="text-xs text-red-600">{uploadErr}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-200">
        <div className="space-y-2">
          <div>
            <label>Discount ($)</label>
            <input name="discount_amount" type="number" step="0.01" min="0" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label>Tax rate (e.g. 0.0825 for 8.25%)</label>
            <input name="tax_rate" type="number" step="0.0001" min="0" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} className="w-full" />
          </div>
        </div>
        <div className="card-padded">
          <Row label="Subtotal" value={formatCurrency(subtotal)} />
          <Row label="Discount" value={`− ${formatCurrency(discount)}`} />
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
