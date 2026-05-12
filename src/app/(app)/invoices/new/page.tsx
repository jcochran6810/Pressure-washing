import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { createInvoice } from "../actions";
import { LineItemEditor } from "@/components/line-item-editor";
import { customerDisplayName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { customer } = await searchParams;
  const [{ data: customers }, { data: services }] = await Promise.all([
    supabase.from("customers").select("id, first_name, last_name, company_name").eq("organization_id", organizationId),
    supabase.from("services").select("id, name, default_price").eq("organization_id", organizationId).eq("active", true).order("name"),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const due = new Date();
  due.setDate(due.getDate() + 14);

  return (
    <div className="max-w-3xl">
      <Link href="/invoices" className="text-sm text-brand-600 hover:underline">← Invoices</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">New invoice</h1>
      <form action={createInvoice} className="space-y-5">
        <div className="card-padded grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label>Customer</label>
            <select name="customer_id" defaultValue={customer || ""} required className="w-full">
              <option value="">Select customer…</option>
              {customers?.map((c) => <option key={c.id} value={c.id}>{customerDisplayName(c)}</option>)}
            </select>
          </div>
          <div>
            <label>Issue date</label>
            <input name="issue_date" type="date" defaultValue={today} className="w-full" />
          </div>
          <div>
            <label>Due date</label>
            <input name="due_date" type="date" defaultValue={due.toISOString().slice(0, 10)} className="w-full" />
          </div>
        </div>

        <div className="card-padded">
          <h2 className="font-semibold mb-3">Line items</h2>
          <LineItemEditor services={(services as any) ?? []} />
        </div>

        <div className="card-padded space-y-3">
          <div>
            <label>Notes</label>
            <textarea name="notes" rows={2} className="w-full" placeholder="Thanks for your business!" />
          </div>
          <div>
            <label>Terms</label>
            <textarea name="terms" rows={2} className="w-full" defaultValue="Net 14. Late fee may apply after due date." />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Link href="/invoices" className="btn-secondary">Cancel</Link>
          <button className="btn-primary">Create invoice</button>
        </div>
      </form>
    </div>
  );
}
