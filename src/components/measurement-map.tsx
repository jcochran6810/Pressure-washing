"use client";

import { useEffect, useRef, useState } from "react";

declare global { interface Window { google: any; __gmapsReady?: Promise<void> } }

const MATERIALS = ["Concrete", "Brick", "Asphalt", "Wood", "Composite", "Vinyl", "Stucco", "Brick veneer", "Roof shingle", "Roof tile", "Gravel", "Pavers", "Other"];

type Polygon = {
  id: string;
  label: string;
  material: string;
  service_id: string | null;
  path: { lat: number; lng: number }[];
  area_sqft: number;
  poly: any;
};

type Service = { id: string; name: string; default_price: number | null; pricing_unit: string | null };

function loadMaps(apiKey: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("server"));
  if (window.__gmapsReady) return window.__gmapsReady;
  window.__gmapsReady = new Promise<void>((resolve, reject) => {
    if (window.google?.maps) return resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,geometry,places`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return window.__gmapsReady;
}

export function MeasurementMap({
  apiKey,
  initialAddress,
  initialCenter,
  services,
  onChange,
}: {
  apiKey: string | null;
  initialAddress?: string;
  initialCenter?: { lat: number; lng: number };
  services: Service[];
  onChange?: (polys: Polygon[]) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const drawingMgr = useRef<any>(null);
  const [polys, setPolys] = useState<Polygon[]>([]);
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState(initialAddress || "");

  useEffect(() => {
    if (!apiKey) {
      setStatus("Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local to enable the map.");
      return;
    }
    let cancelled = false;
    loadMaps(apiKey).then(() => {
      if (cancelled || !mapRef.current) return;
      const center = initialCenter || { lat: 39.8283, lng: -98.5795 };
      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: initialCenter ? 20 : 5,
        mapTypeId: "hybrid",
        tilt: 0,
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
      });
      mapInstance.current = map;
      const dm = new window.google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: true,
        drawingControlOptions: {
          position: window.google.maps.ControlPosition.TOP_CENTER,
          drawingModes: ["polygon"],
        },
        polygonOptions: {
          fillColor: "#3b82f6",
          fillOpacity: 0.35,
          strokeColor: "#1d4ed8",
          strokeWeight: 2,
          editable: true,
          draggable: false,
        },
      });
      dm.setMap(map);
      drawingMgr.current = dm;

      window.google.maps.event.addListener(dm, "polygoncomplete", (poly: any) => {
        dm.setDrawingMode(null);
        const id = crypto.randomUUID();
        attachPoly(id, poly);
      });

      if (initialAddress) geocode(initialAddress);
    }).catch((err) => setStatus(err.message));
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  function attachPoly(id: string, poly: any) {
    const recompute = () => {
      const path = poly.getPath().getArray().map((ll: any) => ({ lat: ll.lat(), lng: ll.lng() }));
      const area_m2 = window.google.maps.geometry.spherical.computeArea(poly.getPath());
      const area_sqft = area_m2 * 10.7639;
      setPolys((prev) => {
        const updated = prev.map((p) => p.id === id ? { ...p, path, area_sqft } : p);
        if (!prev.find((p) => p.id === id)) {
          updated.push({ id, label: "Area " + (prev.length + 1), material: "Concrete", service_id: null, path, area_sqft, poly });
        }
        onChange?.(updated);
        return updated;
      });
    };
    recompute();
    poly.getPath().addListener("set_at", recompute);
    poly.getPath().addListener("insert_at", recompute);
    poly.getPath().addListener("remove_at", recompute);
    poly.addListener("rightclick", (e: any) => {
      if (e.vertex !== undefined) poly.getPath().removeAt(e.vertex);
    });
  }

  function updatePoly(id: string, patch: Partial<Polygon>) {
    setPolys((prev) => {
      const updated = prev.map((p) => p.id === id ? { ...p, ...patch } : p);
      onChange?.(updated);
      return updated;
    });
  }

  function removePoly(id: string) {
    setPolys((prev) => {
      const p = prev.find((x) => x.id === id);
      p?.poly?.setMap(null);
      const updated = prev.filter((x) => x.id !== id);
      onChange?.(updated);
      return updated;
    });
  }

  async function geocode(addr: string) {
    if (!apiKey || !window.google?.maps) return;
    setStatus("Searching…");
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: addr }, (res: any, st: any) => {
      if (st === "OK" && res[0]) {
        const loc = res[0].geometry.location;
        mapInstance.current?.setCenter(loc);
        mapInstance.current?.setZoom(20);
        setStatus("");
      } else {
        setStatus("Could not find that address.");
      }
    });
  }

  const totalSqft = polys.reduce((s, p) => s + p.area_sqft, 0);

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => { e.preventDefault(); geocode(search); }}
        className="flex gap-2"
      >
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search property address…" className="flex-1" />
        <button type="submit" className="btn-secondary">Go</button>
      </form>

      <div ref={mapRef} className="w-full h-[420px] bg-gray-200 rounded-lg overflow-hidden border border-gray-200" />
      {status && <p className="text-xs text-amber-700">{status}</p>}
      <p className="text-xs text-gray-500">Tip: pick the polygon tool at the top of the map, click to add corners, double-click to finish. Right-click a corner to remove it.</p>

      {polys.length > 0 && (
        <div className="card">
          <div className="px-4 py-2 border-b flex items-center justify-between">
            <h3 className="font-semibold">Measured areas</h3>
            <p className="text-sm font-medium">Total: {Math.round(totalSqft).toLocaleString()} sqft</p>
          </div>
          <ul className="divide-y divide-gray-100">
            {polys.map((p) => (
              <li key={p.id} className="px-4 py-3 grid grid-cols-12 gap-2 items-center">
                <input
                  value={p.label}
                  onChange={(e) => updatePoly(p.id, { label: e.target.value })}
                  className="col-span-12 sm:col-span-3 text-sm"
                />
                <select value={p.material} onChange={(e) => updatePoly(p.id, { material: e.target.value })} className="col-span-6 sm:col-span-3 text-sm">
                  {MATERIALS.map((m) => <option key={m}>{m}</option>)}
                </select>
                <select
                  value={p.service_id ?? ""}
                  onChange={(e) => updatePoly(p.id, { service_id: e.target.value || null })}
                  className="col-span-6 sm:col-span-3 text-sm"
                >
                  <option value="">— Service —</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <span className="col-span-10 sm:col-span-2 text-sm font-medium text-right">{Math.round(p.area_sqft).toLocaleString()} sqft</span>
                <button type="button" onClick={() => removePoly(p.id)} className="col-span-2 sm:col-span-1 text-right text-red-600 text-sm">✕</button>

                {/* Hidden inputs so a parent form can submit them */}
                <input type="hidden" name="m_label" value={p.label} />
                <input type="hidden" name="m_material" value={p.material} />
                <input type="hidden" name="m_service_id" value={p.service_id ?? ""} />
                <input type="hidden" name="m_area_sqft" value={p.area_sqft.toString()} />
                <input type="hidden" name="m_polygon" value={JSON.stringify(p.path)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
