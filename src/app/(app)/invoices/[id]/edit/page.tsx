import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { updateInvoice } from "../../actions";
import { LineItemEditor } from "@/components/line-item-editor";
import { CustomerPicker } from "@/components/customer-picker";
import { ScrollToTop } from "@/components/scroll-to-top";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await getSessionAndOrg();

  const { data: inv } = await supabase
    .from("invoices")
    .select("*, invoice_line_items(*)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!inv) notFound();

  if (inv.status === "paid" || inv.status === "void") {
    return (
      <div className="max-w-2xl">
        <ScrollToTop />
        <Link href={`/invoices/${id}`} className="text-sm text-brand-600 hover:underline">← Back to invoice</Link>
        <div className="card-padded mt-3 bg-amber-50 border-amber-300">
          <h1 className="text-xl font-bold">Invoice is locked</h1>
          <p className="text-sm text-gray-700 mt-2">
            This invoice has been {inv.status === "paid" ? "paid" : "voided"} and can no longer be edited.
            Issue a credit note or a new invoice if changes are required.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: customers }, { data: services }] = await Promise.all([
    supabase.from("customers").select("id, first_name, last_name, company_name").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("services").select("id, name, default_price").eq("organization_id", organizationId).eq("active", true).order("name"),
  ]);

  const sortedItems = ((inv.invoice_line_items as any[]) ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const initialItems = sortedItems.map((li) => ({
    description: li.description as string,
    quantity: Number(li.quantity ?? 0),
    unit_price: Number(li.unit_price ?? 0),
    photos: (li.photo_urls as string[]) ?? [],
    materials_description: (li.materials_description as string | null) ?? "",
    materials_cost: Number(li.materials_cost ?? 0),
  }));
  const update = updateInvoice.bind(null, id);

  return (
    <div className="max-w-3xl">
      <ScrollToTop />
      <Link href={`/invoices/${id}`} className="text-sm text-brand-600 hover:underline">← Back to invoice</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">Edit invoice {inv.invoice_number}</h1>

      <form action={update} className="space-y-5">
        <div className="card-padded grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <CustomerPicker initialCustomers={(customers as any) ?? []} defaultCustomerId={inv.customer_id} />
          </div>
          <div>
            <label>Issue date</label>
            <input name="issue_date" type="date" defaultValue={inv.issue_date ?? ""} className="w-full" />
          </div>
          <div>
            <label>Due date</label>
            <input name="due_date" type="date" defaultValue={inv.due_date ?? ""} className="w-full" />
          </div>
        </div>

        <div className="card-padded">
          <h2 className="font-semibold mb-3">Line items</h2>
          <LineItemEditor
            services={(services as any) ?? []}
            initial={initialItems}
            taxRateInitial={Number(inv.tax_rate ?? 0)}
            discountInitial={Number(inv.discount_amount ?? 0)}
            organizationId={organizationId}
            mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null}
          />
        </div>

        <div className="card-padded space-y-3">
          <div>
            <label>Notes</label>
            <textarea name="notes" rows={2} className="w-full" defaultValue={inv.notes ?? ""} />
          </div>
          <div>
            <label>Terms</label>
            <textarea name="terms" rows={2} className="w-full" defaultValue={inv.terms ?? "Net 14. Late fee may apply after due date."} />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Link href={`/invoices/${id}`} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Save changes</button>
        </div>
      </form>
    </div>
  );
}
