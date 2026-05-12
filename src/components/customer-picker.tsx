"use client";

import { useState } from "react";
import { customerDisplayName } from "@/lib/utils";
import { quickCreateCustomer } from "@/app/(app)/customers/quick-actions";

type Customer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
};

export function CustomerPicker({
  initialCustomers,
  defaultCustomerId,
  name = "customer_id",
}: {
  initialCustomers: Customer[];
  defaultCustomerId?: string;
  name?: string;
}) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [selectedId, setSelectedId] = useState<string>(defaultCustomerId ?? "");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Inline new-customer fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<"residential" | "commercial">("residential");

  async function handleCreate() {
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("first_name", firstName);
    fd.append("last_name", lastName);
    fd.append("company_name", companyName);
    fd.append("email", email);
    fd.append("phone", phone);
    fd.append("customer_type", type);
    const result = await quickCreateCustomer(fd);
    setBusy(false);
    if ("error" in result) {
      setErr(result.error);
      return;
    }
    const next: Customer = {
      id: result.id,
      first_name: firstName || null,
      last_name: lastName || null,
      company_name: companyName || null,
    };
    setCustomers((arr) => [next, ...arr]);
    setSelectedId(result.id);
    setCreating(false);
    setFirstName(""); setLastName(""); setCompanyName(""); setEmail(""); setPhone("");
  }

  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label>Customer</label>
          <select
            name={name}
            required
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full"
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {customerDisplayName(c)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setCreating((s) => !s)}
          className="btn-secondary whitespace-nowrap"
        >
          {creating ? "Cancel" : "+ New customer"}
        </button>
      </div>

      {creating && (
        <div className="mt-3 p-3 border border-dashed border-gray-300 rounded-md bg-gray-50 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs">First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="text-xs">Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full" />
            </div>
          </div>
          <div>
            <label className="text-xs">Company (optional)</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="text-xs">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full" />
            </div>
          </div>
          <div>
            <label className="text-xs">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full">
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || (!firstName && !lastName && !companyName)}
            className="btn-primary text-sm w-full"
          >
            {busy ? "Creating…" : "Save customer & select"}
          </button>
        </div>
      )}
    </div>
  );
}
