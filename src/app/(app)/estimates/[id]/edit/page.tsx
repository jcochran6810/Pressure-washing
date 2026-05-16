import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { updateEstimate } from "../../actions";
import { LineItemEditor } from "@/components/line-item-editor";
import { AutoSave } from "@/components/auto-save";

export const dynamic = "force-dynamic";

export default async function EditEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await getSessionAndOrg();

  const [{ data: est }, { data: services }] = await Promise.all([
    supabase.from("estimates").select("*, estimate_line_items(*)").eq("id", id).eq("organization_id", organizationId).single(),
    supabase.from("services").select("id, name, default_price").eq("organization_id", organizationId).eq("active", true).order("name"),
  ]);
  if (!est) notFound();

  if (est.status === "converted" || est.status === "accepted") {
    return (
      <div className="max-w-2xl">
        <Link href={`/estimates/${id}`} className="text-sm text-brand-600 hover:underline">← Estimate</Link>
        <div className="card-padded mt-3">
          <h1 className="text-xl font-bold mb-2">Estimate locked</h1>
          <p className="text-sm text-gray-600">
            This estimate has already been {est.status}. To make changes, create a new estimate or revert its status from the detail page.
          </p>
        </div>
      </div>
    );
  }

  const items = (est.estimate_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const initial = items.map((li) => ({
    description: li.description,
    quantity: Number(li.quantity ?? 1),
    unit_price: Number(li.unit_price ?? 0),
    photos: li.photo_urls ?? [],
  }));

  const action = updateEstimate.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href={`/estimates/${id}`} className="text-sm text-brand-600 hover:underline">← Estimate {est.estimate_number}</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">Edit estimate</h1>

      <form id="estimate-edit-form" action={action} className="space-y-5">
        <AutoSave entityType="estimate" entityId={id} formId="estimate-edit-form" />
        <div className="card-padded grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label>Issue date</label>
            <input name="issue_date" type="date" defaultValue={est.issue_date ?? ""} className="w-full" />
          </div>
          <div>
            <label>Expires</label>
            <input name="expires_at" type="date" defaultValue={est.expires_at ?? ""} className="w-full" />
          </div>
          <div>
            <label>Tax rate</label>
            <input name="tax_rate" type="number" step="0.0001" min="0" max="1" defaultValue={est.tax_rate ?? 0} className="w-full" />
          </div>
          <div>
            <label>Discount</label>
            <input name="discount_amount" type="number" step="0.01" min="0" defaultValue={est.discount_amount ?? 0} className="w-full" />
          </div>
          <div>
            <label>Duration (min, internal)</label>
            <input name="duration_minutes" type="number" min="0" defaultValue={est.duration_minutes ?? ""} className="w-full" />
          </div>
          <div>
            <label>Buffer (min, internal)</label>
            <input name="buffer_minutes" type="number" min="0" defaultValue={est.buffer_minutes ?? 30} className="w-full" />
          </div>
          <div className="sm:col-span-2">
            <input type="hidden" name="customer_id" value={est.customer_id ?? ""} />
            {est.property_id && <input type="hidden" name="property_id" value={est.property_id} />}
          </div>
        </div>

        <div className="card-padded">
          <h2 className="font-semibold mb-3">Line items</h2>
          <LineItemEditor
            services={(services as any) ?? []}
            organizationId={organizationId}
            mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null}
            initial={initial}
            taxRateInitial={Number(est.tax_rate ?? 0)}
            discountInitial={Number(est.discount_amount ?? 0)}
          />
        </div>

        <div className="card-padded space-y-3">
          <div>
            <label>Notes (visible to customer)</label>
            <textarea name="notes" rows={3} className="w-full" defaultValue={est.notes ?? ""} />
          </div>
          <div>
            <label>Terms</label>
            <textarea name="terms" rows={2} className="w-full" defaultValue={est.terms ?? ""} />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Link href={`/estimates/${id}`} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Save changes</button>
        </div>
      </form>
    </div>
  );
}
