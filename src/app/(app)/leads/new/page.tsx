import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { createLead } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: sources } = await supabase.from("lead_sources").select("id, name").eq("organization_id", organizationId).eq("active", true).order("name");

  return (
    <div className="max-w-2xl">
      <Link href="/leads" className="text-sm text-brand-600 hover:underline">← Leads</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">New lead</h1>
      <form action={createLead} className="card-padded space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label>First name</label><input name="first_name" className="w-full" /></div>
          <div><label>Last name</label><input name="last_name" className="w-full" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label>Phone</label><input name="phone" className="w-full" /></div>
          <div><label>Email</label><input name="email" type="email" className="w-full" /></div>
        </div>
        <div><label>Address</label><input name="address" className="w-full" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label>Source</label>
            <select name="source_id" className="w-full">
              <option value="">—</option>
              {sources?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label>Estimated value</label><input name="estimated_value" type="number" step="0.01" min="0" className="w-full" /></div>
        </div>
        <div>
          <label>Status</label>
          <select name="status" defaultValue="new" className="w-full">
            <option>new</option><option>contacted</option><option>quoted</option><option>nurture</option>
          </select>
        </div>
        <div><label>Notes</label><textarea name="notes" rows={3} className="w-full" /></div>
        <div className="flex gap-2 justify-end">
          <Link href="/leads" className="btn-secondary">Cancel</Link>
          <button className="btn-primary">Save lead</button>
        </div>
      </form>
    </div>
  );
}
