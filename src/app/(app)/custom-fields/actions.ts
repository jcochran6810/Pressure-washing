"use server";

import { getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";

const APPLIES_TO = ["customer", "lead", "estimate", "job", "invoice", "property"] as const;
const FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "currency",
  "dropdown",
  "checkbox",
  "date",
  "phone",
  "email",
  "url",
] as const;

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60) || "field";
}

export async function createCustomField(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const applies_to = String(formData.get("applies_to") || "job");
  const field_type = String(formData.get("field_type") || "text");
  const field_label = String(formData.get("field_label") || "").trim();
  if (!field_label) throw new Error("Label required");
  if (!APPLIES_TO.includes(applies_to as any)) throw new Error("Invalid applies_to");
  if (!FIELD_TYPES.includes(field_type as any)) throw new Error("Invalid field_type");
  const optionsRaw = String(formData.get("options") || "");
  const options =
    optionsRaw
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  await (supabase as any).from("custom_fields").insert({
    organization_id: organizationId,
    applies_to,
    field_key: slugify(field_label),
    field_label,
    field_type,
    options: field_type === "dropdown" ? options : [],
    required: formData.get("required") === "on",
    customer_visible: formData.get("customer_visible") === "on",
    sort_order: 100,
  });
  revalidatePath("/custom-fields");
}

export async function updateCustomField(id: string, formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const optionsRaw = String(formData.get("options") || "");
  const options = optionsRaw
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
  await (supabase as any)
    .from("custom_fields")
    .update({
      field_label: String(formData.get("field_label") || "").trim(),
      field_type: String(formData.get("field_type") || "text"),
      options,
      required: formData.get("required") === "on",
      customer_visible: formData.get("customer_visible") === "on",
      active: formData.get("active") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId);
  revalidatePath("/custom-fields");
}

export async function deleteCustomField(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await (supabase as any).from("custom_fields").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/custom-fields");
}

// Save a set of custom field values for an entity (job, estimate, etc.).
// Pass formData entries named "cf_<fieldId>" (and "cf_bool_<fieldId>" for
// checkboxes that need a stable presence). Empty strings clear the value.
export async function saveCustomFieldValues(
  entityType: string,
  entityId: string,
  formData: FormData,
): Promise<void> {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: fields } = await (supabase as any)
    .from("custom_fields")
    .select("id, field_type")
    .eq("organization_id", organizationId)
    .eq("applies_to", entityType)
    .eq("active", true);

  for (const f of (fields ?? []) as any[]) {
    const raw = formData.get(`cf_${f.id}`);
    const checkboxRaw = formData.get(`cf_bool_${f.id}`);
    const patch: any = {
      organization_id: organizationId,
      field_id: f.id,
      entity_type: entityType,
      entity_id: entityId,
      value_text: null,
      value_number: null,
      value_boolean: null,
      value_date: null,
      value_json: null,
      updated_at: new Date().toISOString(),
    };
    switch (f.field_type) {
      case "number":
      case "currency": {
        const n = raw == null || raw === "" ? null : Number(raw);
        patch.value_number = Number.isFinite(n as number) ? (n as number) : null;
        break;
      }
      case "checkbox": {
        // Hidden "_bool_" key always present so absence means false.
        patch.value_boolean = checkboxRaw === "on" || raw === "on";
        break;
      }
      case "date": {
        patch.value_date = raw ? String(raw) : null;
        break;
      }
      default: {
        patch.value_text = raw ? String(raw) : null;
        break;
      }
    }

    // Upsert by composite key (field_id, entity_id) — unique constraint.
    await (supabase as any)
      .from("custom_field_values")
      .upsert(patch, { onConflict: "field_id,entity_id" });
  }
  revalidatePath(`/${entityType}s/${entityId}`);
}
