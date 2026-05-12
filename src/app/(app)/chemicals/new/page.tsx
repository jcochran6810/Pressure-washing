import Link from "next/link";
import { createChemical } from "../actions";

export default function NewChemicalPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/chemicals" className="text-sm text-brand-600 hover:underline">← Chemicals</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">Add chemical</h1>
      <form action={createChemical} className="card-padded space-y-3">
        <div>
          <label>Name</label>
          <input name="name" required placeholder="Sodium Hypochlorite 12.5%" className="w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label>Brand</label><input name="brand" className="w-full" /></div>
          <div><label>SKU</label><input name="sku" className="w-full" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label>Category</label><input name="category" className="w-full" placeholder="Bleach, surfactant, etc." /></div>
          <div><label>Unit</label><input name="unit" defaultValue="gallon" className="w-full" /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label>Current stock</label><input name="current_stock" type="number" step="0.01" min="0" defaultValue={0} className="w-full" /></div>
          <div><label>Reorder at</label><input name="reorder_level" type="number" step="0.01" min="0" defaultValue={0} className="w-full" /></div>
          <div><label>Cost / unit</label><input name="cost_per_unit" type="number" step="0.01" min="0" className="w-full" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label>Supplier</label><input name="supplier" className="w-full" /></div>
          <div><label>Hazard class</label><input name="hazard_class" className="w-full" placeholder="e.g. 5.1, 8" /></div>
        </div>
        <div><label>SDS URL</label><input name="sds_url" type="url" className="w-full" placeholder="https://…" /></div>
        <div><label>Notes</label><textarea name="notes" rows={2} className="w-full" /></div>
        <div className="flex gap-2 justify-end">
          <Link href="/chemicals" className="btn-secondary">Cancel</Link>
          <button className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
