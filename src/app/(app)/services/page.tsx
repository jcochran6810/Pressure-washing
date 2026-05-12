import { getSessionAndOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { createService, updateService, deleteService, updateGlobalPricingSettings } from "./actions";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MATERIALS = ["concrete", "brick", "stucco", "vinyl", "wood", "composite", "roof_shingle", "roof_tile", "pavers"];

export default async function ServicesPage() {
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("organization_id", organizationId)
    .order("is_addon", { ascending: true })
    .order("name");

  return (
    <div>
      <PageHeader title="Services & Pricing" description="Configure how each service is priced — sqft, height, material modifiers, minimum job price." />

      <section className="card-padded mb-5">
        <h2 className="font-semibold mb-3">Global pricing rules</h2>
        <form action={updateGlobalPricingSettings} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label>Minimum job total</label>
            <input name="global_min_job_price" type="number" step="0.01" min="0" defaultValue={Number(organization?.global_min_job_price ?? 0)} className="w-full" />
            <p className="text-xs text-gray-500 mt-1">Any estimate below this rounds up.</p>
          </div>
          <div>
            <label>Deposit threshold ($)</label>
            <input name="deposit_threshold" type="number" step="0.01" min="0" defaultValue={Number(organization?.deposit_threshold ?? 0)} className="w-full" />
            <p className="text-xs text-gray-500 mt-1">Require deposit when estimate exceeds this.</p>
          </div>
          <div>
            <label>Deposit %</label>
            <input name="deposit_percentage" type="number" step="0.01" min="0" max="1" defaultValue={Number(organization?.deposit_percentage ?? 0.25)} className="w-full" />
            <p className="text-xs text-gray-500 mt-1">e.g. 0.25 = 25%.</p>
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <button className="btn-primary">Save rules</button>
          </div>
        </form>
      </section>

      <div className="grid grid-cols-1 gap-4">
        <ServiceForm action={createService} title="Add service" />
        {services?.map((s: any) => (
          <ServiceForm
            key={s.id}
            action={updateService.bind(null, s.id) as any}
            title={s.name}
            service={s}
            onDelete={deleteService.bind(null, s.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ServiceForm({ action, title, service, onDelete }: { action: any; title: string; service?: any; onDelete?: () => Promise<void> }) {
  const materialMods = service?.material_modifiers ?? {};
  return (
    <form action={action} className="card-padded">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold">{title}</h3>
        {service && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="active" defaultChecked={service.active !== false} /> Active
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="is_addon" defaultChecked={!!service.is_addon} /> Add-on
            </label>
            {onDelete && <form action={onDelete}><button className="text-xs text-red-600 hover:underline">Delete</button></form>}
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label>Name</label>
          <input name="name" required defaultValue={service?.name ?? ""} className="w-full" />
        </div>
        <div>
          <label>Category</label>
          <input name="category" defaultValue={service?.category ?? ""} className="w-full" />
        </div>
        <div className="sm:col-span-2">
          <label>Description</label>
          <textarea name="description" rows={2} defaultValue={service?.description ?? ""} className="w-full" />
        </div>
        <div>
          <label>Pricing unit</label>
          <select name="pricing_unit" defaultValue={service?.pricing_unit ?? "flat"} className="w-full">
            <option value="flat">Flat rate</option>
            <option value="sqft">Per sqft</option>
            <option value="linear_ft">Per linear ft</option>
            <option value="hour">Per hour</option>
            <option value="each">Each</option>
          </select>
        </div>
        <div>
          <label>Default price (flat) / hourly</label>
          <input name="default_price" type="number" step="0.01" min="0" defaultValue={service?.default_price ?? 0} className="w-full" />
        </div>
        <div>
          <label>Price per sqft</label>
          <input name="price_per_sqft" type="number" step="0.0001" min="0" defaultValue={service?.price_per_sqft ?? 0} className="w-full" />
        </div>
        <div>
          <label>Price per linear ft</label>
          <input name="price_per_linear_ft" type="number" step="0.0001" min="0" defaultValue={service?.price_per_linear_ft ?? 0} className="w-full" />
        </div>
        <div>
          <label>Minimum charge for this service</label>
          <input name="min_price" type="number" step="0.01" min="0" defaultValue={service?.min_price ?? 0} className="w-full" />
        </div>
        <div>
          <label>Default duration (min)</label>
          <input name="default_duration_minutes" type="number" min="0" defaultValue={service?.default_duration_minutes ?? 60} className="w-full" />
        </div>
        <div>
          <label>Height modifier per story (e.g. 0.15 = +15%)</label>
          <input name="height_modifier_per_story" type="number" step="0.001" min="0" defaultValue={service?.height_modifier_per_story ?? 0.15} className="w-full" />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-semibold mb-2">Material difficulty modifiers</p>
        <p className="text-xs text-gray-500 mb-2">1.0 = no change, 1.2 = +20%, 0.9 = −10%.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MATERIALS.map((m) => (
            <div key={m}>
              <label className="text-xs capitalize">{m.replace("_", " ")}</label>
              <input
                name={`material_mod_${m}`}
                type="number"
                step="0.05"
                min="0"
                defaultValue={Number(materialMods[m] ?? 1)}
                className="w-full text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center mt-4">
        <div className="text-xs text-gray-500">
          {service && service.default_price ? `Effective default: ${formatCurrency(Number(service.default_price))}` : ""}
        </div>
        <button className="btn-primary">{service ? "Save" : "Add service"}</button>
      </div>
    </form>
  );
}
