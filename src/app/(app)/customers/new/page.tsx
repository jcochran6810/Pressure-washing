import Link from "next/link";
import { createCustomer } from "../actions";

export default function NewCustomerPage() {
  return (
    <div className="max-w-2xl">
      <Link href="/customers" className="text-sm text-brand-600 hover:underline">← Customers</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">New customer</h1>

      <form action={createCustomer} className="space-y-5">
        <div className="card-padded space-y-3">
          <div>
            <label>Customer type</label>
            <select name="customer_type" defaultValue="residential" className="w-full">
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>First name</label>
              <input name="first_name" className="w-full" />
            </div>
            <div>
              <label>Last name</label>
              <input name="last_name" className="w-full" />
            </div>
          </div>
          <div>
            <label>Company (optional)</label>
            <input name="company_name" className="w-full" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label>Email</label>
              <input name="email" type="email" className="w-full" />
            </div>
            <div>
              <label>Phone</label>
              <input name="phone" className="w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label>Mobile</label>
              <input name="mobile_phone" className="w-full" />
            </div>
            <div>
              <label>Lead source</label>
              <input name="lead_source" className="w-full" placeholder="Google, referral, etc." />
            </div>
          </div>
          <div>
            <label>Notes</label>
            <textarea name="notes" rows={2} className="w-full" />
          </div>
        </div>

        <div className="card-padded space-y-3">
          <h2 className="font-semibold">Property (optional)</h2>
          <p className="text-sm text-gray-500 -mt-1">Add a service address now or later from the customer page.</p>
          <div>
            <label>Address</label>
            <input name="address_line1" className="w-full" />
          </div>
          <div>
            <label>Address line 2</label>
            <input name="address_line2" className="w-full" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label>City</label>
              <input name="city" className="w-full" />
            </div>
            <div>
              <label>State</label>
              <input name="state" className="w-full" />
            </div>
            <div>
              <label>Zip</label>
              <input name="postal_code" className="w-full" />
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Link href="/customers" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Create customer</button>
        </div>
      </form>
    </div>
  );
}
