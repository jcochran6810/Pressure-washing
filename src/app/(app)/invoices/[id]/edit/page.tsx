import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { updateInvoice } from "../../actions";
import { LineItemEditor } from "@/components/line-item-editor";
import { AutoSave } from "@/components/auto-save";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await getSessionAndOrg();

  const [{ data: inv }, { data: services }] = await Promise.all([
    supabase.from("invoices").select("*, invoice_line_items(*)").eq("id", id).eq("organization_id", organizationId).single(),
    supabase.from("services").select("id, name, default_price").eq("organization_id", organizationId).eq("active", true).order("name"),
  ]);
  if (!inv) notFound();

  if (inv.status === "paid" || inv.status === "void") {
    return (
      <div className="max-w-2xl">
        <Link href={`/invoices/${id}`} className="text-sm text-brand-600 hover:underline">← Invoice</Link>
        <div className="card-padded mt-3">
          <h1 className="text-xl font-bold mb-2">Invoice locked</h1>
          <p className="text-sm text-gray-600">
            Paid and voided invoices can&apos;t be edited. Issue a credit note or new invoice instead.
          </p>
        </div>
      </div>
    );
  }

  const items = (inv.invoice_line_items as any[]).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const initial = items.map((li) => ({
    description: li.description,
    quantity: Number(li.quantity ?? 1),
    unit_price: Number(li.unit_price ?? 0),
    photos: li.photo_urls ?? [],
  }));

  const action = updateInvoice.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href={`/invoices/${id}`} className="text-sm text-brand-600 hover:underline">← Invoice {inv.invoice_number}</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">Edit invoice</h1>
      {Number(inv.amount_paid ?? 0) > 0 && (
        <div className="border border-amber-200 bg-amber-50 text-amber-900 text-sm rounded-md p-3 mb-4">
          This invoice has partial payments of ${Number(inv.amount_paid).toFixed(2)} applied. The new total
          must remain at least equal to what&apos;s already been paid.
        </div>
      )}

      <form id="invoice-edit-form" action={action} className="space-y-5">
        <AutoSave entityType="invoice" entityId={id} formId="invoice-edit-form" />
        <div className="card-padded grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label>Issue date</label>
            <input name="issue_date" type="date" defaultValue={inv.issue_date ?? ""} className="w-full" />
          </div>
          <div>
            <label>Due date</label>
            <input name="due_date" type="date" defaultValue={inv.due_date ?? ""} className="w-full" />
          </div>
          <div>
            <label>Tax rate</label>
            <input name="tax_rate" type="number" step="0.0001" min="0" max="1" defaultValue={inv.tax_rate ?? 0} className="w-full" />
          </div>
          <div>
            <label>Discount</label>
            <input name="discount_amount" type="number" step="0.01" min="0" defaultValue={inv.discount_amount ?? 0} className="w-full" />
          </div>
          <div className="sm:col-span-2">
            <input type="hidden" name="customer_id" value={inv.customer_id ?? ""} />
          </div>
        </div>

        <div className="card-padded">
          <h2 className="font-semibold mb-3">Line items</h2>
          <LineItemEditor
            services={(services as any) ?? []}
            organizationId={organizationId}
            mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null}
            initial={initial}
            taxRateInitial={Number(inv.tax_rate ?? 0)}
            discountInitial={Number(inv.discount_amount ?? 0)}
          />
        </div>

        <div className="card-padded space-y-3">
          <div>
            <label>Notes (visible to customer)</label>
            <textarea name="notes" rows={3} className="w-full" defaultValue={inv.notes ?? ""} />
          </div>
          <div>
            <label>Terms</label>
            <textarea name="terms" rows={2} className="w-full" defaultValue={inv.terms ?? ""} />
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
