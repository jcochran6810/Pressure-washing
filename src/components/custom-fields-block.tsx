// Server component: loads custom fields + values for an entity and renders an
// inline edit form. Wire onto job/estimate/customer detail pages by passing the
// entity_type and entity_id; values are saved via the saveCustomFieldValues
// server action.

import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { saveCustomFieldValues } from "@/app/(app)/custom-fields/actions";

export async function CustomFieldsBlock({
  entityType,
  entityId,
}: {
  entityType: "customer" | "lead" | "estimate" | "job" | "invoice" | "property";
  entityId: string;
}) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const [{ data: fields }, { data: values }] = await Promise.all([
    (supabase as any)
      .from("custom_fields")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("applies_to", entityType)
      .eq("active", true)
      .order("sort_order")
      .order("field_label"),
    (supabase as any)
      .from("custom_field_values")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId),
  ]);

  if (!fields?.length) {
    return (
      <section className="card-padded">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="font-semibold">Custom fields</h2>
          <Link href="/custom-fields" className="text-xs text-brand-600 hover:underline">
            Set up
          </Link>
        </div>
        <p className="text-xs text-gray-500">
          No custom fields defined for {entityType}s yet.
        </p>
      </section>
    );
  }

  const valByFieldId = new Map<string, any>();
  for (const v of (values ?? []) as any[]) valByFieldId.set(v.field_id, v);

  const submit = saveCustomFieldValues.bind(null, entityType, entityId);

  return (
    <section className="card-padded">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold">Details</h2>
        <Link href="/custom-fields" className="text-xs text-brand-600 hover:underline">
          Edit fields
        </Link>
      </div>
      <form action={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(fields as any[]).map((f) => (
          <FieldInput key={f.id} field={f} value={valByFieldId.get(f.id) ?? null} />
        ))}
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" className="btn-secondary text-sm">Save</button>
        </div>
      </form>
    </section>
  );
}

function FieldInput({ field, value }: { field: any; value: any }) {
  const name = `cf_${field.id}`;
  const label = (
    <span className="text-xs text-gray-700">
      {field.field_label}
      {field.required && <span className="text-red-500"> *</span>}
    </span>
  );

  const wrap = (input: React.ReactNode) => (
    <label className="block">
      {label}
      <div className="mt-0.5">{input}</div>
    </label>
  );

  switch (field.field_type) {
    case "long_text":
      return wrap(
        <textarea name={name} defaultValue={value?.value_text ?? ""} rows={3} className="w-full" />,
      );
    case "number":
      return wrap(
        <input name={name} type="number" step="any" defaultValue={value?.value_number ?? ""} className="w-full" />,
      );
    case "currency":
      return wrap(
        <input name={name} type="number" step="0.01" defaultValue={value?.value_number ?? ""} className="w-full" />,
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-xs">
          <input type="hidden" name={`cf_bool_${field.id}`} value="off" />
          <input type="checkbox" name={`cf_bool_${field.id}`} defaultChecked={!!value?.value_boolean} />
          <span>{field.field_label}</span>
        </label>
      );
    case "dropdown":
      return wrap(
        <select name={name} defaultValue={value?.value_text ?? ""} className="w-full">
          <option value="">—</option>
          {((field.options as string[]) ?? []).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>,
      );
    case "date":
      return wrap(
        <input name={name} type="date" defaultValue={value?.value_date ?? ""} className="w-full" />,
      );
    case "phone":
      return wrap(<input name={name} type="tel" defaultValue={value?.value_text ?? ""} className="w-full" />);
    case "email":
      return wrap(<input name={name} type="email" defaultValue={value?.value_text ?? ""} className="w-full" />);
    case "url":
      return wrap(<input name={name} type="url" defaultValue={value?.value_text ?? ""} className="w-full" />);
    default:
      return wrap(<input name={name} type="text" defaultValue={value?.value_text ?? ""} className="w-full" />);
  }
}
