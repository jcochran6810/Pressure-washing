import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { createJob } from "../actions";
import { customerDisplayName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { customer } = await searchParams;
  const { data: customers } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl">
      <Link href="/jobs" className="text-sm text-brand-600 hover:underline">← Jobs</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">Schedule a job</h1>

      <form action={createJob} className="card-padded space-y-3">
        <div>
          <label>Title</label>
          <input name="title" required placeholder="House wash — Smith residence" className="w-full" />
        </div>
        <div>
          <label>Customer</label>
          <select name="customer_id" required defaultValue={customer || ""} className="w-full">
            <option value="">Select customer…</option>
            {customers?.map((c) => <option key={c.id} value={c.id}>{customerDisplayName(c)}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label>Start</label>
            <input name="scheduled_start" type="datetime-local" className="w-full" />
          </div>
          <div>
            <label>End</label>
            <input name="scheduled_end" type="datetime-local" className="w-full" />
          </div>
        </div>
        <div>
          <label>Amount</label>
          <input name="total_amount" type="number" step="0.01" min="0" defaultValue={0} className="w-full" />
        </div>
        <div>
          <label>Status</label>
          <select name="status" defaultValue="scheduled" className="w-full">
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On hold</option>
          </select>
        </div>
        <div>
          <label>Description / job notes</label>
          <textarea name="description" rows={3} className="w-full" />
        </div>
        <div className="flex gap-2 justify-end">
          <Link href="/jobs" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Schedule job</button>
        </div>
      </form>
    </div>
  );
}
