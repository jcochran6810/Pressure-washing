import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { createCustomField, updateCustomField, deleteCustomField } from "./actions";

export const dynamic = "force-dynamic";

const APPLIES_TO_OPTIONS = [
  { value: "job", label: "Job" },
  { value: "estimate", label: "Estimate" },
  { value: "customer", label: "Customer" },
  { value: "lead", label: "Lead" },
  { value: "invoice", label: "Invoice" },
  { value: "property", label: "Property" },
];

const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Short text" },
  { value: "long_text", label: "Long text / notes" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "dropdown", label: "Dropdown (one of)" },
  { value: "checkbox", label: "Yes / No" },
  { value: "date", label: "Date" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
];

export default async function CustomFieldsPage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: fields } = await (supabase as any)
    .from("custom_fields")
    .select("*")
    .eq("organization_id", organizationId)
    .order("applies_to")
    .order("sort_order")
    .order("field_label");

  const grouped = new Map<string, any[]>();
  for (const f of (fields ?? []) as any[]) {
    const key = f.applies_to;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(f);
  }

  return (
    <div>
      <PageHeader
        title="Custom fields"
        description="Capture trade-specific details on customers, leads, estimates, jobs, invoices, and properties — yard size, gate code, fixture model, you name it."
      />

      <section className="card-padded mb-6">
        <h2 className="font-semibold mb-3">Add a custom field</h2>
        <form action={createCustomField} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs">
            Field label
            <input name="field_label" required className="w-full mt-0.5" placeholder="e.g. Yard size (sq ft)" />
          </label>
          <label className="text-xs">
            Where it lives
            <select name="applies_to" defaultValue="job" className="w-full mt-0.5">
              {APPLIES_TO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Field type
            <select name="field_type" defaultValue="text" className="w-full mt-0.5">
              {FIELD_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Dropdown options (one per line, only for dropdown type)
            <textarea name="options" rows={3} className="w-full mt-0.5" placeholder={"Concrete\nBrick\nStucco"} />
          </label>
          <label className="text-xs flex items-center gap-2 self-end">
            <input type="checkbox" name="required" /> Required
          </label>
          <label className="text-xs flex items-center gap-2 self-end">
            <input type="checkbox" name="customer_visible" /> Show on customer-facing docs
          </label>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" className="btn-primary text-sm">Add field</button>
          </div>
        </form>
      </section>

      {!fields?.length ? (
        <EmptyState
          title="No custom fields yet"
          description="Add fields above, or load your trade's defaults from the Services page."
        />
      ) : (
        <div className="space-y-5">
          {APPLIES_TO_OPTIONS.map((opt) => {
            const list = grouped.get(opt.value);
            if (!list?.length) return null;
            return (
              <section key={opt.value}>
                <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-500 mb-2">
                  {opt.label} fields
                </h3>
                <div className="space-y-2">
                  {list.map((f) => (
                    <FieldRow key={f.id} field={f} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FieldRow({ field }: { field: any }) {
  const update = updateCustomField.bind(null, field.id);
  const del = deleteCustomField.bind(null, field.id);
  return (
    <form action={update} className="card-padded">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{field.field_label}</p>
          <p className="text-xs text-gray-500">
            <code>{field.field_key}</code> · {field.field_type}
            {field.required ? " · required" : ""}
            {field.customer_visible ? " · customer visible" : ""}
            {field.active === false ? " · inactive" : ""}
          </p>
        </div>
        <form action={del}>
          <button type="submit" className="text-xs text-red-600 hover:underline">Delete</button>
        </form>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs">
          Label
          <input name="field_label" defaultValue={field.field_label} required className="w-full mt-0.5" />
        </label>
        <label className="text-xs">
          Type
          <select name="field_type" defaultValue={field.field_type} className="w-full mt-0.5">
            {FIELD_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs sm:col-span-2">
          Dropdown options (one per line)
          <textarea
            name="options"
            rows={3}
            defaultValue={(field.options ?? []).join("\n")}
            className="w-full mt-0.5"
          />
        </label>
        <label className="text-xs flex items-center gap-2">
          <input type="checkbox" name="required" defaultChecked={!!field.required} /> Required
        </label>
        <label className="text-xs flex items-center gap-2">
          <input type="checkbox" name="customer_visible" defaultChecked={!!field.customer_visible} /> Show on customer docs
        </label>
        <label className="text-xs flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={field.active !== false} /> Active
        </label>
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" className="btn-secondary text-sm">Save</button>
        </div>
      </div>
    </form>
  );
}
