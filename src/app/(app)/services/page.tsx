import { getSessionAndOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { createService, updateService, deleteService, updateGlobalPricingSettings, loadTradeDefaults } from "./actions";
import { formatCurrency } from "@/lib/utils";
import { getDefaultsForTrades, getFormConfigForTrades, PRICING_UNITS, type ServiceFormConfig } from "@/lib/trade-defaults";

export const dynamic = "force-dynamic";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; services?: string; fields?: string }>;
}) {
  const { saved, error, services: addedServices, fields: addedFields } = await searchParams;
  const { supabase, organizationId, organization } = await getSessionAndOrg();
  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("organization_id", organizationId)
    .order("is_addon", { ascending: true })
    .order("name");

  const { data: orgBusinessTypes } = await (supabase as any)
    .from("organization_business_types")
    .select("business_type_id")
    .eq("organization_id", organizationId);
  const businessTypeIds: string[] = (orgBusinessTypes ?? []).map((r: any) => r.business_type_id);
  // Fallback to the legacy single column if the join table is empty.
  if (businessTypeIds.length === 0) {
    const fallback = (organization as any)?.business_type_id;
    if (fallback) businessTypeIds.push(fallback);
  }
  const businessTypeId = businessTypeIds[0] ?? "pressure_washing";
  const tradeDefaults = getDefaultsForTrades(businessTypeIds);
  const formConfig = getFormConfigForTrades(businessTypeIds);
  const existingNames = new Set((services ?? []).map((s: any) => (s.name ?? "").toLowerCase()));
  const missingDefaults = tradeDefaults.filter((d) => !existingNames.has(d.name.toLowerCase()));

  const savedSvcCount = Number(addedServices ?? 0);
  const savedFieldCount = Number(addedFields ?? 0);

  return (
    <div>
      <PageHeader title="Services & Pricing" description="Configure your service catalog, pricing, duration, and minimum job rules. Fields shown adapt to your trade." />

      {saved === "trade_defaults" && (
        <div className="border rounded-md p-3 text-sm mb-4 bg-green-50 text-green-800 border-green-200">
          Loaded {savedSvcCount} service{savedSvcCount === 1 ? "" : "s"}
          {savedFieldCount > 0 ? ` and ${savedFieldCount} custom field${savedFieldCount === 1 ? "" : "s"}` : ""} from the
          {" "}{businessTypeId.replace(/_/g, " ")} starter set.
          {savedSvcCount === 0 && savedFieldCount === 0 && " Everything was already in place — nothing new to add."}
        </div>
      )}
      {error && (
        <div className="border rounded-md p-3 text-sm mb-4 bg-red-50 text-red-800 border-red-200">
          {error}
        </div>
      )}

      {missingDefaults.length > 0 && (
        <section className="card-padded mb-5 border-brand-200 bg-brand-50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-brand-800">
                {missingDefaults.length} default service{missingDefaults.length === 1 ? "" : "s"} from your trade aren't in your catalog yet
              </h2>
              <p className="text-xs text-brand-700 mt-1">
                Pre-priced templates pulled from the {businessTypeId.replace(/_/g, " ")} starter set. You can edit or delete each one after.
              </p>
              <p className="text-[11px] text-brand-700/70 mt-2">
                {missingDefaults.slice(0, 6).map((d) => d.name).join(" · ")}
                {missingDefaults.length > 6 ? ` +${missingDefaults.length - 6} more` : ""}
              </p>
            </div>
            <form action={loadTradeDefaults}>
              <button className="btn-primary text-sm whitespace-nowrap">Load trade defaults</button>
            </form>
          </div>
        </section>
      )}

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
        <ServiceForm action={createService} title="Add service" formConfig={formConfig} />
        {services?.map((s: any) => (
          <ServiceForm
            key={s.id}
            action={updateService.bind(null, s.id) as any}
            title={s.name}
            service={s}
            onDelete={deleteService.bind(null, s.id)}
            formConfig={formConfig}
          />
        ))}
      </div>
    </div>
  );
}

function ServiceForm({ action, title, service, onDelete, formConfig }: { action: any; title: string; service?: any; onDelete?: () => Promise<void>; formConfig: ServiceFormConfig }) {
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
            {PRICING_UNITS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Default price</label>
          <input name="default_price" type="number" step="0.01" min="0" defaultValue={service?.default_price ?? 0} className="w-full" />
        </div>
        {formConfig.showPricePerSqft && (
          <div>
            <label>Price per sqft</label>
            <input name="price_per_sqft" type="number" step="0.0001" min="0" defaultValue={service?.price_per_sqft ?? 0} className="w-full" />
          </div>
        )}
        {formConfig.showPricePerLinearFt && (
          <div>
            <label>Price per linear ft</label>
            <input name="price_per_linear_ft" type="number" step="0.0001" min="0" defaultValue={service?.price_per_linear_ft ?? 0} className="w-full" />
          </div>
        )}
        <div>
          <label>Minimum charge for this service</label>
          <input name="min_price" type="number" step="0.01" min="0" defaultValue={service?.min_price ?? 0} className="w-full" />
        </div>
        <div>
          <label>Default duration (min)</label>
          <input name="default_duration_minutes" type="number" min="0" defaultValue={service?.default_duration_minutes ?? 60} className="w-full" />
        </div>
        {formConfig.showHeightModifier && (
          <div>
            <label>Height modifier per story (e.g. 0.15 = +15%)</label>
            <input name="height_modifier_per_story" type="number" step="0.001" min="0" defaultValue={service?.height_modifier_per_story ?? 0.15} className="w-full" />
          </div>
        )}
      </div>

      {formConfig.showMaterialModifiers && formConfig.materials.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold mb-2">Material difficulty modifiers</p>
          <p className="text-xs text-gray-500 mb-2">1.0 = no change, 1.2 = +20%, 0.9 = −10%.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {formConfig.materials.map((m) => (
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
      )}

      <div className="flex justify-between items-center mt-4">
        <div className="text-xs text-gray-500">
          {service && service.default_price ? `Effective default: ${formatCurrency(Number(service.default_price))}` : ""}
        </div>
        <button className="btn-primary">{service ? "Save" : "Add service"}</button>
      </div>
    </form>
  );
}
