import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { customerDisplayName, formatDate, statusColor } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";
import { deleteWaiver, requestWaiverSignature, updateWaiver } from "../actions";

export const dynamic = "force-dynamic";

export default async function WaiverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: waiver } = await (supabase as any)
    .from("waivers")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!waiver) notFound();

  const [{ data: customers }, { data: signatures }] = await Promise.all([
    supabase.from("customers").select("id, first_name, last_name, company_name, email, phone, mobile_phone").eq("organization_id", organizationId),
    (supabase as any)
      .from("waiver_signatures")
      .select("id, token, status, signed_at, signer_name, signer_email, customers(first_name, last_name, company_name)")
      .eq("waiver_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const update = updateWaiver.bind(null, id);
  const del = deleteWaiver.bind(null, id);
  const requestSig = requestWaiverSignature.bind(null, id);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  return (
    <div className="max-w-3xl">
      <Link href="/waivers" className="text-sm text-brand-600 hover:underline">← Waivers</Link>
      <h1 className="text-2xl sm:text-3xl font-bold mt-2 mb-1">{waiver.name}</h1>
      <p className="text-sm text-gray-600 mb-5">v{waiver.version} {waiver.active ? "· active" : "· inactive"}</p>

      <form action={update} className="card-padded space-y-3 mb-5">
        <div>
          <label>Name</label>
          <input name="name" defaultValue={waiver.name} required className="w-full" />
        </div>
        <div>
          <label>Body</label>
          <textarea name="body" defaultValue={waiver.body} rows={12} required className="w-full font-mono text-xs" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={waiver.active} />
          Active
        </label>
        <div className="flex justify-end gap-2">
          <form action={del}><button className="btn-ghost text-red-600 text-xs">Delete</button></form>
          <button className="btn-primary">Save changes</button>
        </div>
      </form>

      <section className="card-padded mb-5">
        <h2 className="font-semibold mb-2">Send to a customer for signature</h2>
        <form action={requestSig} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <label>
            Customer
            <select name="customer_id" required className="w-full mt-0.5">
              <option value="">Select customer…</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>{customerDisplayName(c)}</option>
              ))}
            </select>
          </label>
          <label>
            Send via
            <select name="channel" defaultValue="email" className="w-full mt-0.5">
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </label>
          <label>
            Override email
            <input name="signer_email" type="email" placeholder="optional" className="w-full mt-0.5" />
          </label>
          <label>
            Override phone
            <input name="signer_phone" type="tel" placeholder="optional" className="w-full mt-0.5" />
          </label>
          <div className="sm:col-span-2 flex justify-end">
            <button className="btn-primary">Send signing link</button>
          </div>
        </form>
      </section>

      <h2 className="font-semibold mb-2">Signatures</h2>
      {!signatures?.length ? (
        <p className="text-sm text-gray-500">No signature requests yet.</p>
      ) : (
        <div className="card">
          <ul className="divide-y divide-gray-100 text-sm">
            {signatures.map((s: any) => {
              const url = `${baseUrl}/waiver/${s.token}`;
              return (
                <li key={s.id} className="px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-medium">{s.customers?.company_name || [s.customers?.first_name, s.customers?.last_name].filter(Boolean).join(" ") || "—"}</span>
                  <span className="text-gray-500 text-xs truncate">{s.signer_email}</span>
                  <span className={`badge ${statusColor(s.status)}`}>{s.status}</span>
                  <span className="text-gray-500 text-xs">{s.signed_at ? formatDate(s.signed_at) : "—"}</span>
                  {s.status === "pending" && <CopyButton value={url} label="Copy link" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
