import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { createExpense } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const [{ data: categories }, { data: drive }] = await Promise.all([
    supabase.from("expense_categories").select("id, name").eq("organization_id", organizationId).order("name"),
    supabase.from("google_drive_connections").select("connected_email").eq("organization_id", organizationId).maybeSingle(),
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-2xl">
      <Link href="/expenses" className="text-sm text-brand-600 hover:underline">← Expenses</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">New expense</h1>
      <form action={createExpense} className="card-padded space-y-3" encType="multipart/form-data">
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

        <div className="border-t border-gray-200 pt-3">
          <label>Receipt photo</label>
          <div className="border border-dashed border-gray-300 rounded-md p-3 bg-gray-50">
            <input
              name="receipt_photo"
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="w-full text-sm"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Snaps from your phone camera work. Saved to{" "}
              {drive?.connected_email
                ? <span className="font-medium text-green-700">your Google Drive ({drive.connected_email})</span>
                : <>your Supabase storage. <Link href="/settings" className="text-brand-600 underline">Connect Google Drive</Link> to send receipts there instead.</>}
            </p>
          </div>

          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer">Or paste a URL instead</summary>
            <input name="receipt_url" type="url" className="w-full mt-1" placeholder="https://drive.google.com/…" />
          </details>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Link href="/expenses" className="btn-secondary">Cancel</Link>
          <button className="btn-primary">Save expense</button>
        </div>
      </form>
    </div>
  );
}
