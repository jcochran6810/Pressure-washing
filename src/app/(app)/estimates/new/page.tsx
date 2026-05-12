import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { createEstimate } from "../actions";
import { LineItemEditor } from "@/components/line-item-editor";
import { CustomerPicker } from "@/components/customer-picker";

export const dynamic = "force-dynamic";

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; property?: string; from_measurements?: string }>;
}) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { customer, property, from_measurements } = await searchParams;

  // services + price_per_sqft (price_per_sqft is in the live DB; not in the
  // typed schema yet so we read it as a loose field below)
  const [{ data: customers }, { data: services }] = await Promise.all([
    supabase.from("customers").select("id, first_name, last_name, company_name").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("services").select("id, name, default_price").eq("organization_id", organizationId).eq("active", true).order("name"),
  ]);

  // If a property was passed, optionally pre-fill line items from its saved
  // satellite measurements. Each measurement becomes one line:
  //   qty       = area_sqft
  //   unit_price = service.price_per_sqft (0 if the service has none / no service)
  //   description = "<material> — <label>"  e.g. "Concrete — Driveway"
  let initialItems:
    | { description: string; quantity: number; unit_price: number; photos: string[] }[]
    | undefined;
  let initialAddress: string | undefined;
  let measurementsCount = 0;

  if (property) {
    const [{ data: prop }, { data: measurements }, { data: fullServices }] = await Promise.all([
      supabase
        .from("properties")
        .select("address_line1, city, state")
        .eq("id", property)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("measurements")
        .select("label, material, service_id, area_sqft")
        .eq("property_id", property)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }),
      // Reload services with the wider per-sqft pricing field for unit-price lookup
      supabase
        .from("services")
        .select("id, name, default_price, price_per_sqft, pricing_unit")
        .eq("organization_id", organizationId)
        .eq("active", true),
    ]);
    if (prop) {
      initialAddress = [prop.address_line1, prop.city, prop.state].filter(Boolean).join(", ");
    }
    if (measurements?.length && (from_measurements === "1" || measurements.length > 0)) {
      const svcById = new Map<string, any>((fullServices ?? []).map((s: any) => [s.id, s]));
      initialItems = measurements
        .filter((m: any) => Number(m.area_sqft ?? 0) > 0)
        .map((m: any) => {
          const svc = m.service_id ? svcById.get(m.service_id) : null;
          const pricePerSqft = svc ? Number((svc as any).price_per_sqft ?? 0) : 0;
          const label = m.label || "Area";
          const material = m.material || "";
          return {
            description: material ? `${material} — ${label}${svc ? ` (${svc.name})` : ""}` : `${label}${svc ? ` — ${svc.name}` : ""}`,
            quantity: Number(m.area_sqft ?? 0),
            unit_price: pricePerSqft,
            photos: [] as string[],
          };
        });
      measurementsCount = initialItems.length;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);

  return (
    <div className="max-w-3xl">
      <Link href="/estimates" className="text-sm text-brand-600 hover:underline">← Estimates</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">New estimate</h1>

      {!!measurementsCount && (
        <div className="card-padded mb-4 border-brand-300 ring-1 ring-brand-100">
          <p className="text-sm">
            <strong>{measurementsCount} line {measurementsCount === 1 ? "item" : "items"} pre-filled from your
            satellite measurements.</strong> Square footage flows in as the quantity; if a service was tagged on
            the polygon, the per-sqft price was looked up too. Adjust anything below before saving.
          </p>
        </div>
      )}

      <form action={createEstimate} className="space-y-5">
        <input type="hidden" name="property_id" value={property ?? ""} />
        <div className="card-padded grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <CustomerPicker initialCustomers={(customers as any) ?? []} defaultCustomerId={customer} />
          </div>
          <div>
            <label>Issue date</label>
            <input name="issue_date" type="date" defaultValue={today} className="w-full" />
          </div>
          <div>
            <label>Expires (30 days default)</label>
            <input name="expires_at" type="date" defaultValue={expiry.toISOString().slice(0, 10)} className="w-full" />
          </div>
          <div>
            <label>Estimated duration (min) — internal</label>
            <input name="duration_minutes" type="number" min="0" placeholder="e.g. 120" className="w-full" />
          </div>
          <div>
            <label>Buffer (min) — internal only</label>
            <input name="buffer_minutes" type="number" min="0" defaultValue={30} className="w-full" />
          </div>
        </div>

        <div className="card-padded">
          <h2 className="font-semibold mb-3">Line items</h2>
          <LineItemEditor
            services={(services as any) ?? []}
            initial={initialItems}
            organizationId={organizationId}
            mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null}
            initialAddress={initialAddress}
          />
        </div>

        <div className="card-padded space-y-3">
          <div>
            <label>Notes (visible to customer)</label>
            <textarea name="notes" rows={3} className="w-full" />
          </div>
          <div>
            <label>Terms</label>
            <textarea name="terms" rows={2} className="w-full" defaultValue="Estimate valid for 30 days. Payment due upon completion." />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Link href="/estimates" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Create estimate</button>
        </div>
      </form>
    </div>
  );
}
