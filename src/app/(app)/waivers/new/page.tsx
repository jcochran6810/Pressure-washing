import Link from "next/link";
import { createWaiver } from "../actions";

export const dynamic = "force-dynamic";

const PLACEHOLDER = `LIABILITY WAIVER & PROPERTY ACCESS AGREEMENT

By signing below, I authorize [Business Name] to access the property and perform pressure-washing services described in the related estimate…`;

export default function NewWaiverPage() {
  return (
    <div className="max-w-3xl">
      <Link href="/waivers" className="text-sm text-brand-600 hover:underline">← Waivers</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">New waiver</h1>

      <form action={createWaiver} className="card-padded space-y-3">
        <div>
          <label>Name</label>
          <input name="name" required placeholder="Standard service waiver" className="w-full" />
        </div>
        <div>
          <label>Body</label>
          <textarea name="body" rows={14} required placeholder={PLACEHOLDER} className="w-full font-mono text-xs" />
          <p className="text-xs text-gray-500 mt-1">
            Plain text. You can include <code>{"{{org_name}}"}</code> to interpolate your business name.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked />
          Active (available to send to customers)
        </label>
        <div className="flex justify-end gap-2">
          <Link href="/waivers" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary">Create waiver</button>
        </div>
      </form>
    </div>
  );
}
