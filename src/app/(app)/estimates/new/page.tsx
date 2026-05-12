import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { createEstimate } from "../actions";
import { LineItemEditor } from "@/components/line-item-editor";
import { CustomerPicker } from "@/components/customer-picker";

export const dynamic = "force-dynamic";

export default async function NewEstimatePage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { customer } = await searchParams;

  const [{ data: customers }, { data: services }] = await Promise.all([
    supabase.from("customers").select("id, first_name, last_name, company_name").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("services").select("id, name, default_price").eq("organization_id", organizationId).eq("active", true).order("name"),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);

  return (
    <div className="max-w-3xl">
      <Link href="/estimates" className="text-sm text-brand-600 hover:underline">← Estimates</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">New estimate</h1>

      <form action={createEstimate} className="space-y-5">
        <div className="card-padded grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <CustomerPicker initialCustomers={(customers as any) ?? []} defaultCustomerId={customer} />
          </div>
          <div>
            <label>Issue date</label>
            <input name="issue_date" type="date" defaultValue={today} className="w-full" />
          </div>
          <div>
            <label>Expires (30 days default)</label>
            <input name="expires_at" type="date" defaultValue={expiry.toISOString().slice(0, 10)} className="w-full" />
          </div>
          <div>
            <label>Estimated duration (min) — internal</label>
            <input name="duration_minutes" type="number" min="0" placeholder="e.g. 120" className="w-full" />
          </div>
          <div>
            <label>Buffer (min) — internal only</label>
            <input name="buffer_minutes" type="number" min="0" defaultValue={30} className="w-full" />
          </div>
        </div>

        <div className="card-padded">
          <h2 className="font-semibold mb-3">Line items</h2>
          <LineItemEditor
            services={(services as any) ?? []}
            organizationId={organizationId}
            mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null}
          />
        </div>

        <div className="card-padded space-y-3">
          <div>
            <label>Notes (visible to customer)</label>
            <textarea name="notes" rows={3} className="w-full" />
          </div>
          <div>
            <label>Terms</label>
            <textarea name="terms" rows={2} className="w-full" defaultValue="Estimate valid for 30 days. Payment due upon completion." />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Link href="/estimates" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Create estimate</button>
        </div>
      </form>
    </div>
  );
}
