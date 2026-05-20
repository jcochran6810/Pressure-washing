import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { updateEstimate } from "../../actions";
import { isEstimateEditable } from "../../helpers";
import { LineItemEditor } from "@/components/line-item-editor";
import { CustomerPicker } from "@/components/customer-picker";

export const dynamic = "force-dynamic";

export default async function EditEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId, organization } = await getSessionAndOrg();

  const [{ data: est }, { data: customers }, { data: services }, { data: docPhotos }] = await Promise.all([
    supabase
      .from("estimates")
      .select("*, estimate_line_items(*), customers(id, first_name, last_name, company_name)")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase.from("customers").select("id, first_name, last_name, company_name").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("services").select("id, name, default_price, default_kind, default_taxable").eq("organization_id", organizationId).eq("active", true).order("name"),
    supabase
      .from("photo_attachments")
      .select("url, caption")
      .eq("estimate_id", id)
      .eq("organization_id", organizationId)
      .eq("kind", "reference")
      .order("created_at", { ascending: true }),
  ]);

  if (!est) notFound();
  if (!isEstimateEditable((est as any).status)) {
    // Sent / accepted / converted — push them back to the view page rather
    // than confusing them with a locked form. The view page surfaces a hint
    // explaining why it's not editable.
    redirect(`/estimates/${id}?locked=1`);
  }

  const items = ((est as any).estimate_line_items as any[])
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((li) => ({
      description: li.description,
      quantity: Number(li.quantity ?? 1),
      unit_price: Number(li.unit_price ?? 0),
      kind: (li.kind as "labor" | "material" | "service" | "other") ?? "service",
      taxable: li.taxable !== false,
      line_group: (li.line_group as string | null) ?? null,
      photo_urls: (li.photo_urls as string[] | null) ?? null,
    }));
  const initialDocPhotos = (docPhotos ?? []).map((p: any) => ({
    url: p.url as string,
    note: (p.caption as string | null) ?? "",
  }));

  const update = updateEstimate.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href={`/estimates/${id}`} className="text-sm text-brand-600 hover:underline">← Back to estimate</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Edit estimate {(est as any).estimate_number}</h1>
      <p className="text-sm text-gray-600 mb-5">
        Editable while in draft. Once you send or get customer approval, this view will lock —
        duplicate it to make further changes after that.
      </p>

      <form action={update} className="space-y-5">
        <div className="card-padded grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <CustomerPicker
              initialCustomers={(customers as any) ?? []}
              defaultCustomerId={(est as any).customer_id}
            />
          </div>
          <div>
            <label>Issue date</label>
            <input name="issue_date" type="date" defaultValue={(est as any).issue_date ?? ""} className="w-full" />
          </div>
          <div>
            <label>Expires</label>
            <input name="expires_at" type="date" defaultValue={(est as any).expires_at ?? ""} className="w-full" />
          </div>
          <div>
            <label>Estimated duration (min) — internal</label>
            <input name="duration_minutes" type="number" min="0" defaultValue={(est as any).duration_minutes ?? ""} className="w-full" />
          </div>
          <div>
            <label>Buffer (min) — internal only</label>
            <input name="buffer_minutes" type="number" min="0" defaultValue={(est as any).buffer_minutes ?? 30} className="w-full" />
          </div>
        </div>

        <div className="card-padded">
          <h2 className="font-semibold mb-3">Line items</h2>
          <LineItemEditor
            services={(services as any) ?? []}
            initial={items}
            initialDocPhotos={initialDocPhotos}
            taxRateInitial={Number((est as any).tax_rate ?? organization?.tax_rate ?? 0)}
            discountInitial={Number((est as any).discount_amount ?? 0)}
            organizationId={organizationId}
            mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null}
          />
        </div>

        <div className="card-padded space-y-3">
          <div>
            <label>Notes (visible to customer)</label>
            <textarea name="notes" rows={3} defaultValue={(est as any).notes ?? ""} className="w-full" />
          </div>
          <div>
            <label>Terms</label>
            <textarea name="terms" rows={2} defaultValue={(est as any).terms ?? ""} className="w-full" />
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
