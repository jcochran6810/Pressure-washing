import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { formatDate, statusColor } from "@/lib/utils";
import { seedDefaultWaiver } from "./actions";

export const dynamic = "force-dynamic";

export default async function WaiversPage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const [{ data: waivers }, { data: recent }] = await Promise.all([
    (supabase as any)
      .from("waivers")
      .select("id, name, version, active, updated_at")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false }),
    (supabase as any)
      .from("waiver_signatures")
      .select("id, status, signed_at, signer_name, waivers(name), customers(first_name, last_name, company_name)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Waivers & signed documents</h1>
          <p className="text-sm text-gray-600">
            Capture customer-signed waivers with IP, user-agent, and timestamp audit trails.
          </p>
        </div>
        <div className="flex gap-2">
          {!waivers?.length && (
            <form action={seedDefaultWaiver}><button className="btn-secondary">Seed default waiver</button></form>
          )}
          <Link href="/waivers/new" className="btn-primary">+ New waiver</Link>
        </div>
      </div>

      {!waivers?.length ? (
        <div className="card-padded text-sm text-gray-600">
          No waivers yet. Seed a default template or write your own.
        </div>
      ) : (
        <div className="table-wrap mb-6">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Version</th>
                <th>Active</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {waivers.map((w: any) => (
                <tr key={w.id}>
                  <td>
                    <Link href={`/waivers/${w.id}`} className="font-medium text-brand-700 hover:underline">{w.name}</Link>
                  </td>
                  <td>v{w.version}</td>
                  <td>{w.active ? "Yes" : "No"}</td>
                  <td>{formatDate(w.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="font-semibold mb-2">Recent signatures</h2>
      {!recent?.length ? (
        <p className="text-sm text-gray-500">No signatures yet.</p>
      ) : (
        <div className="card">
          <ul className="divide-y divide-gray-100 text-sm">
            {recent.map((s: any) => (
              <li key={s.id} className="px-4 py-2 flex justify-between items-center gap-3">
                <span className="truncate">
                  <span className="font-medium">{s.waivers?.name ?? "Waiver"}</span>
                  <span className="text-gray-500"> · {s.customers?.company_name || [s.customers?.first_name, s.customers?.last_name].filter(Boolean).join(" ") || "—"}</span>
                </span>
                <span className={`badge ${statusColor(s.status)}`}>{s.status}</span>
                <span className="text-gray-500 text-xs">{s.signed_at ? formatDate(s.signed_at) : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
