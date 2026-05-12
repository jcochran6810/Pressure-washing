import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { MeasurementMap } from "@/components/measurement-map";
import { saveMeasurements } from "./actions";
import { customerDisplayName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MeasurePage({ searchParams }: { searchParams: Promise<{ property?: string }> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { property } = await searchParams;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;

  const [{ data: properties }, { data: services }, { data: existing }] = await Promise.all([
    supabase
      .from("properties")
      .select("id, nickname, address_line1, city, state, latitude, longitude, customers(first_name, last_name, company_name)")
      .eq("organization_id", organizationId),
    supabase.from("services").select("id, name, default_price, pricing_unit").eq("organization_id", organizationId).eq("active", true).order("name"),
    property ? supabase.from("measurements").select("*").eq("property_id", property).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
  ]);

  const selected = property ? properties?.find((p) => p.id === property) : null;
  const initialAddress = selected
    ? [selected.address_line1, selected.city, selected.state].filter(Boolean).join(", ")
    : undefined;
  const initialCenter = selected?.latitude && selected?.longitude
    ? { lat: Number(selected.latitude), lng: Number(selected.longitude) }
    : undefined;

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-1">Measure</h1>
      <p className="text-sm text-gray-600 mb-5">Draw polygons on the satellite map to measure surface area. Tag each area with material and service.</p>

      {!apiKey && (
        <div className="card-padded mb-4 border-amber-300 bg-amber-50">
          <p className="text-sm">
            <strong>Maps API key required.</strong> Add{" "}
            <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to your{" "}
            <code className="bg-amber-100 px-1 rounded">.env.local</code> to enable the satellite measurement tool.
            Enable Maps JavaScript, Drawing, Geometry, Places, and Geocoding APIs in Google Cloud Console.
          </p>
        </div>
      )}

      <form action={saveMeasurements} className="space-y-4">
        <div className="card-padded">
          <label>Attach to property (optional)</label>
          <select name="property_id" defaultValue={property || ""} className="w-full">
            <option value="">— Standalone measurement (don't save to property) —</option>
            {properties?.map((p: any) => (
              <option key={p.id} value={p.id}>
                {customerDisplayName(p.customers ?? {})} — {p.nickname || p.address_line1}
              </option>
            ))}
          </select>
        </div>

        <MeasurementMap
          apiKey={apiKey}
          initialAddress={initialAddress}
          initialCenter={initialCenter}
          services={(services as any) ?? []}
        />

        <div className="flex justify-end">
          <button className="btn-primary">Save measurements</button>
        </div>
      </form>

      {!!existing?.length && (
        <div className="card mt-6">
          <header className="px-4 py-3 border-b">
            <h2 className="font-semibold">Saved measurements for this property</h2>
          </header>
          <ul className="divide-y divide-gray-100">
            {existing.map((m: any) => (
              <li key={m.id} className="px-4 py-2 flex justify-between text-sm">
                <span>{m.label || "Area"} • {m.material || "—"}</span>
                <span className="font-medium">{Math.round(Number(m.area_sqft ?? 0)).toLocaleString()} sqft</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
