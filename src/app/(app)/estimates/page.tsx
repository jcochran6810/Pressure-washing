import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { customerDisplayName, formatCurrency, formatDate, statusColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function EstimatesPage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data } = await supabase
    .from("estimates")
    .select("id, estimate_number, status, issue_date, expires_at, total, customers(first_name, last_name, company_name)")
    .eq("organization_id", organizationId)
    .order("issue_date", { ascending: false });

  if (!data?.length) {
    return (
      <div>
        <PageHeader title="Estimates" description="Quote work to customers." action={{ label: "New estimate", href: "/estimates/new" }} />
        <EmptyState title="No estimates yet" action={{ label: "New estimate", href: "/estimates/new" }} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Estimates" description="Quote work to customers." action={{ label: "New estimate", href: "/estimates/new" }} />
      <div className="table-wrap overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Customer</th>
              <th className="hidden sm:table-cell">Issued</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((e: any) => (
              <tr key={e.id}>
                <td><Link href={`/estimates/${e.id}`} className="font-medium hover:text-brand-700">{e.estimate_number}</Link></td>
                <td>{customerDisplayName(e.customers ?? {})}</td>
                <td className="hidden sm:table-cell text-gray-500">{formatDate(e.issue_date)}</td>
                <td className="font-medium">{formatCurrency(Number(e.total))}</td>
                <td><span className={`badge ${statusColor(e.status)}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
