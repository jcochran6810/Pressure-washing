import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { updateInvoice } from "../../actions";
import { isInvoiceEditable } from "../../helpers";
import { LineItemEditor } from "@/components/line-item-editor";
import { CustomerPicker } from "@/components/customer-picker";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId, organization } = await getSessionAndOrg();

  const [{ data: inv }, { data: customers }, { data: services }, { data: docPhotos }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, invoice_line_items(*), customers(id, first_name, last_name, company_name)")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase.from("customers").select("id, first_name, last_name, company_name").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("services").select("id, name, default_price, default_kind, default_taxable").eq("organization_id", organizationId).eq("active", true).order("name"),
    supabase
      .from("photo_attachments")
      .select("url, caption")
      .eq("invoice_id", id)
      .eq("organization_id", organizationId)
      .eq("kind", "reference")
      .order("created_at", { ascending: true }),
  ]);

  if (!inv) notFound();
  if (!isInvoiceEditable((inv as any).status)) {
    redirect(`/invoices/${id}?locked=1`);
  }

  const items = ((inv as any).invoice_line_items as any[])
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((li) => ({
      description: li.description,
      quantity: Number(li.quantity ?? 1),
      unit_price: Number(li.unit_price ?? 0),
      kind: (li.kind as "labor" | "material" | "service" | "other") ?? "service",
      taxable: li.taxable !== false,
      line_group: (li.line_group as string | null) ?? null,
    }));
  const initialDocPhotos = (docPhotos ?? []).map((p: any) => ({
    url: p.url as string,
    note: (p.caption as string | null) ?? "",
  }));

  const update = updateInvoice.bind(null, id);

  return (
    <div className="max-w-3xl">
      <Link href={`/invoices/${id}`} className="text-sm text-brand-600 hover:underline">← Back to invoice</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Edit invoice {(inv as any).invoice_number}</h1>
      <p className="text-sm text-gray-600 mb-5">
        Editable while in draft. Once you send it (or it gets paid), this view will lock —
        record an adjustment or issue a credit invoice if you need to change something later.
      </p>

      <form action={update} className="space-y-5">
        <div className="card-padded grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <CustomerPicker
              initialCustomers={(customers as any) ?? []}
              defaultCustomerId={(inv as any).customer_id}
            />
          </div>
          <div>
            <label>Issue date</label>
            <input name="issue_date" type="date" defaultValue={(inv as any).issue_date ?? ""} className="w-full" />
          </div>
          <div>
            <label>Due date</label>
            <input name="due_date" type="date" defaultValue={(inv as any).due_date ?? ""} className="w-full" />
          </div>
        </div>

        <div className="card-padded">
          <h2 className="font-semibold mb-3">Line items</h2>
          <LineItemEditor
            services={(services as any) ?? []}
            initial={items}
            initialDocPhotos={initialDocPhotos}
            taxRateInitial={Number((inv as any).tax_rate ?? organization?.tax_rate ?? 0)}
            discountInitial={Number((inv as any).discount_amount ?? 0)}
            organizationId={organizationId}
            mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null}
          />
        </div>

        <div className="card-padded space-y-3">
          <div>
            <label>Notes</label>
            <textarea name="notes" rows={2} defaultValue={(inv as any).notes ?? ""} className="w-full" />
          </div>
          <div>
            <label>Terms</label>
            <textarea name="terms" rows={2} defaultValue={(inv as any).terms ?? ""} className="w-full" />
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
