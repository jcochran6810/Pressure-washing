import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { createExpense } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: categories } = await supabase.from("expense_categories").select("id, name").eq("organization_id", organizationId).order("name");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-2xl">
      <Link href="/expenses" className="text-sm text-brand-600 hover:underline">← Expenses</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">New expense</h1>
      <form action={createExpense} className="card-padded space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label>Date</label><input name="expense_date" type="date" defaultValue={today} className="w-full" /></div>
          <div><label>Amount</label><input name="amount" type="number" step="0.01" min="0" required className="w-full" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label>Vendor</label><input name="vendor" className="w-full" placeholder="Home Depot, Pure Power, etc." /></div>
          <div>
            <label>Category</label>
            <select name="category_id" className="w-full">
              <option value="">Uncategorized</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label>Payment method</label><input name="payment_method" className="w-full" placeholder="Card, cash, ACH" /></div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="tax_deductible" defaultChecked />
              <span>Tax deductible</span>
            </label>
          </div>
        </div>
        <div><label>Description</label><textarea name="description" rows={2} className="w-full" /></div>
        <div><label>Receipt URL</label><input name="receipt_url" type="url" className="w-full" placeholder="Drive / Dropbox link" /></div>
        <div className="flex gap-2 justify-end">
          <Link href="/expenses" className="btn-secondary">Cancel</Link>
          <button className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  );
}
