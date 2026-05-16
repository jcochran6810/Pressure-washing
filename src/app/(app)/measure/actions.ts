"use server";

import { getSessionAndOrgForMutation as getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveMeasurements(formData: FormData) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const property_id = (String(formData.get("property_id") || "") || null) as string | null;

  const labels = formData.getAll("m_label") as string[];
  const materials = formData.getAll("m_material") as string[];
  const serviceIds = formData.getAll("m_service_id") as string[];
  const areas = formData.getAll("m_area_sqft") as string[];
  const polygons = formData.getAll("m_polygon") as string[];

  const rows = labels.map((label, i) => {
    const path = JSON.parse(polygons[i] || "[]") as { lat: number; lng: number }[];
    const center = path.length
      ? { lat: path.reduce((s, p) => s + p.lat, 0) / path.length, lng: path.reduce((s, p) => s + p.lng, 0) / path.length }
      : null;
    return {
      organization_id: organizationId,
      property_id,
      label,
      material: materials[i] || null,
      service_id: serviceIds[i] || null,
      area_sqft: Number(areas[i] || 0),
      polygon: path,
      center_lat: center?.lat ?? null,
      center_lng: center?.lng ?? null,
    };
  });

  if (rows.length) {
    await supabase.from("measurements").insert(rows);
    // If property has no coords, set them from first measurement center
    if (property_id && rows[0]?.center_lat) {
      await supabase.from("properties").update({ latitude: rows[0].center_lat, longitude: rows[0].center_lng }).eq("id", property_id);
    }
  }

  revalidatePath("/measure");
  if (property_id) redirect(`/customers`);
  redirect("/measure");
}

export async function deleteMeasurement(id: string) {
  const { supabase, organizationId } = await getSessionAndOrg();
  await supabase.from("measurements").delete().eq("id", id).eq("organization_id", organizationId);
  revalidatePath("/measure");
}
