import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { customerDisplayName, formatCurrency, formatDate, statusColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: contracts } = await (supabase as any)
    .from("contracts")
    .select("id, name, status, cadence_months, next_run_date, default_amount, customers(first_name, last_name, company_name), properties(address_line1, nickname)")
    .eq("organization_id", organizationId)
    .order("next_run_date");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Contracts & recurring services</h1>
          <p className="text-sm text-gray-600">Annual / quarterly / monthly service plans — drafts the next estimate or job automatically.</p>
        </div>
        <Link href="/contracts/new" className="btn-primary">+ New contract</Link>
      </div>

      {!contracts?.length ? (
        <div className="card-padded text-center text-sm text-gray-600">
          No contracts yet. Set one up to auto-draft your annual house washes, quarterly window cleans, monthly commercial routes, etc.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Customer</th>
                <th>Property</th>
                <th>Cadence</th>
                <th>Next run</th>
                <th>Default amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c: any) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/contracts/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.name}</Link>
                  </td>
                  <td>{customerDisplayName(c.customers ?? {})}</td>
                  <td className="truncate max-w-[180px]">{c.properties?.nickname || c.properties?.address_line1 || "—"}</td>
                  <td>Every {c.cadence_months} mo</td>
                  <td>{formatDate(c.next_run_date)}</td>
                  <td>{c.default_amount ? formatCurrency(Number(c.default_amount)) : "—"}</td>
                  <td><span className={`badge ${statusColor(c.status)}`}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
