import Link from "next/link";
import { createEquipment } from "../actions";

export default function NewEquipmentPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/equipment" className="text-sm text-brand-600 hover:underline">← Equipment</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">Add equipment</h1>
      <form action={createEquipment} className="card-padded space-y-3">
        <div><label>Name</label><input name="name" required placeholder="8gpm Pressure Pro" className="w-full" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label>Type</label><input name="type" placeholder="Pump / Surface cleaner / Trailer" className="w-full" /></div>
          <div><label>Serial #</label><input name="serial_number" className="w-full" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label>Purchase date</label><input name="purchase_date" type="date" className="w-full" /></div>
          <div><label>Purchase price</label><input name="purchase_price" type="number" step="0.01" min="0" className="w-full" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label>Last service</label><input name="last_service_date" type="date" className="w-full" /></div>
          <div><label>Next service</label><input name="next_service_date" type="date" className="w-full" /></div>
        </div>
        <div><label>Hours used</label><input name="hours_used" type="number" step="0.1" min="0" className="w-full" /></div>
        <div><label>Notes</label><textarea name="notes" rows={2} className="w-full" /></div>
        <div className="flex gap-2 justify-end">
          <Link href="/equipment" className="btn-secondary">Cancel</Link>
          <button className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
