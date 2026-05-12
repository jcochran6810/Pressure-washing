import Link from "next/link";
import { createCampaign } from "../actions";

export default function NewCampaignPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/campaigns" className="text-sm text-brand-600 hover:underline">← Campaigns</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">New campaign</h1>
      <form action={createCampaign} className="card-padded space-y-3">
        <div><label>Name</label><input name="name" required placeholder="Spring 2026 Google Ads" className="w-full" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label>Channel</label><input name="channel" placeholder="Google, Facebook, Door hangers" className="w-full" /></div>
          <div><label>Budget</label><input name="budget" type="number" step="0.01" min="0" className="w-full" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label>Start</label><input name="start_date" type="date" className="w-full" /></div>
          <div><label>End</label><input name="end_date" type="date" className="w-full" /></div>
        </div>
        <div><label>Notes</label><textarea name="notes" rows={2} className="w-full" /></div>
        <div className="flex gap-2 justify-end">
          <Link href="/campaigns" className="btn-secondary">Cancel</Link>
          <button className="btn-primary">Save campaign</button>
        </div>
      </form>
    </div>
  );
}
