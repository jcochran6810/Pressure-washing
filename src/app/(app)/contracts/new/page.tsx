import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { createContract } from "../actions";
import { customerDisplayName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { customer } = await searchParams;

  const [{ data: customers }, { data: services }] = await Promise.all([
    supabase.from("customers").select("id, first_name, last_name, company_name").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("services").select("id, name, default_price").eq("organization_id", organizationId),
  ]);

  return (
    <div className="max-w-3xl">
      <Link href="/contracts" className="text-sm text-brand-600 hover:underline">← Contracts</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">New contract</h1>

      <form action={createContract} className="card-padded space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label>Name</label>
            <input name="name" required placeholder="Annual house wash — Smith" className="w-full" />
          </div>
          <div>
            <label>Customer</label>
            <select name="customer_id" required defaultValue={customer || ""} className="w-full">
              <option value="">Select customer…</option>
              {customers?.map((c) => <option key={c.id} value={c.id}>{customerDisplayName(c)}</option>)}
            </select>
          </div>
          <div>
            <label>Cadence (months)</label>
            <input name="cadence_months" type="number" min={1} max={60} defaultValue={12} required className="w-full" />
          </div>
          <div>
            <label>Preferred day of month</label>
            <input name="preferred_day" type="number" min={1} max={28} placeholder="optional" className="w-full" />
          </div>
          <div>
            <label>Start date</label>
            <input name="start_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full" />
          </div>
          <div>
            <label>Default amount (overrides line items)</label>
            <input name="default_amount" type="number" min={0} step="0.01" placeholder="0.00" className="w-full" />
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Service template (line items applied each cycle)</legend>
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input name="svc_description" placeholder="Service description" className="col-span-7" defaultValue={i === 0 ? services?.[0]?.name ?? "" : ""} />
              <input name="svc_quantity" type="number" step="0.01" placeholder="Qty" defaultValue={1} className="col-span-2" />
              <input name="svc_unit_price" type="number" step="0.01" placeholder="Price" defaultValue={i === 0 ? services?.[0]?.default_price ?? 0 : 0} className="col-span-3" />
            </div>
          ))}
        </fieldset>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="auto_create_estimate" defaultChecked />
            Auto-draft an estimate each cycle
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="auto_create_job" />
            Auto-create a scheduled job each cycle
          </label>
        </div>

        <div>
          <label>Notes</label>
          <textarea name="notes" rows={3} className="w-full" />
        </div>

        <div className="flex gap-2 justify-end">
          <Link href="/contracts" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Create contract</button>
        </div>
      </form>
    </div>
  );
}
