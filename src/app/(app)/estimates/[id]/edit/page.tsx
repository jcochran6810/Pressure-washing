import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { updateEstimate } from "../../actions";
import { LineItemEditor } from "@/components/line-item-editor";
import { CustomerPicker } from "@/components/customer-picker";
import { ScrollToTop } from "@/components/scroll-to-top";

export const dynamic = "force-dynamic";

export default async function EditEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await getSessionAndOrg();

  const { data: est } = await supabase
    .from("estimates")
    .select("*, estimate_line_items(*)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!est) notFound();

  if (est.status === "accepted" || est.status === "converted") {
    return (
      <div className="max-w-2xl">
        <ScrollToTop />
        <Link href={`/estimates/${id}`} className="text-sm text-brand-600 hover:underline">← Back to estimate</Link>
        <div className="card-padded mt-3 bg-amber-50 border-amber-300">
          <h1 className="text-xl font-bold">Estimate is locked</h1>
          <p className="text-sm text-gray-700 mt-2">
            This estimate has been {est.status === "converted" ? "converted to an invoice" : "accepted by the customer"} and can no longer be edited.
            To change it, create a new estimate.
          </p>
          <Link href="/estimates/new" className="btn-primary mt-3 inline-block">+ New estimate</Link>
        </div>
      </div>
    );
  }

  const [{ data: customers }, { data: services }] = await Promise.all([
    supabase.from("customers").select("id, first_name, last_name, company_name").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("services").select("id, name, default_price").eq("organization_id", organizationId).eq("active", true).order("name"),
  ]);

  const sortedItems = ((est.estimate_line_items as any[]) ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const initialItems = sortedItems.map((li) => ({
    description: li.description as string,
    quantity: Number(li.quantity ?? 0),
    unit_price: Number(li.unit_price ?? 0),
    photos: (li.photo_urls as string[]) ?? [],
  }));
  const update = updateEstimate.bind(null, id);

  return (
    <div className="max-w-3xl">
      <ScrollToTop />
      <Link href={`/estimates/${id}`} className="text-sm text-brand-600 hover:underline">← Back to estimate</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">Edit estimate {est.estimate_number}</h1>

      <form action={update} className="space-y-5">
        <div className="card-padded grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <CustomerPicker initialCustomers={(customers as any) ?? []} defaultCustomerId={est.customer_id} />
          </div>
          <div>
            <label>Issue date</label>
            <input name="issue_date" type="date" defaultValue={est.issue_date ?? ""} className="w-full" />
          </div>
          <div>
            <label>Expires (30 days default)</label>
            <input name="expires_at" type="date" defaultValue={est.expires_at ?? ""} className="w-full" />
          </div>
          <div>
            <label>Estimated duration (min) — internal</label>
            <input name="duration_minutes" type="number" min="0" defaultValue={est.duration_minutes ?? ""} className="w-full" />
          </div>
          <div>
            <label>Buffer (min) — internal only</label>
            <input name="buffer_minutes" type="number" min="0" defaultValue={est.buffer_minutes ?? 30} className="w-full" />
          </div>
        </div>

        <div className="card-padded">
          <h2 className="font-semibold mb-3">Line items</h2>
          <LineItemEditor
            services={(services as any) ?? []}
            initial={initialItems}
            taxRateInitial={Number(est.tax_rate ?? 0)}
            discountInitial={Number(est.discount_amount ?? 0)}
            organizationId={organizationId}
            mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null}
          />
        </div>

        <div className="card-padded space-y-3">
          <div>
            <label>Notes (visible to customer)</label>
            <textarea name="notes" rows={3} className="w-full" defaultValue={est.notes ?? ""} />
          </div>
          <div>
            <label>Terms</label>
            <textarea name="terms" rows={2} className="w-full" defaultValue={est.terms ?? "Estimate valid for 30 days. Payment due upon completion."} />
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
