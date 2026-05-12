import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { customerDisplayName, formatCurrency, formatDate, statusColor } from "@/lib/utils";
import { documentLabel } from "@/lib/document-number";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { status } = await searchParams;

  let query = supabase
    .from("invoices")
    .select("id, invoice_number, status, total, balance_due, due_date, issue_date, customers(first_name, last_name, company_name)")
    .eq("organization_id", organizationId)
    .order("issue_date", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data } = await query;

  if (!data?.length) {
    return (
      <div>
        <PageHeader title="Invoices" description="Bill customers, track payments." action={{ label: "New invoice", href: "/invoices/new" }} />
        <EmptyState title="No invoices yet" action={{ label: "New invoice", href: "/invoices/new" }} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Invoices" description="Bill customers, track payments." action={{ label: "New invoice", href: "/invoices/new" }} />
      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <FilterTab href="/invoices" label="All" active={!status} />
        {["draft", "sent", "partial", "paid", "overdue"].map((s) => (
          <FilterTab key={s} href={`/invoices?status=${s}`} label={s} active={status === s} />
        ))}
      </div>
      <div className="table-wrap overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Customer</th>
              <th className="hidden sm:table-cell">Issued</th>
              <th className="hidden sm:table-cell">Due</th>
              <th>Total</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((i: any) => (
              <tr key={i.id}>
                <td><Link href={`/invoices/${i.id}`} className="font-medium hover:text-brand-700">{documentLabel("invoice", i.status, i.invoice_number)}</Link></td>
                <td>{customerDisplayName(i.customers ?? {})}</td>
                <td className="hidden sm:table-cell text-gray-500">{formatDate(i.issue_date)}</td>
                <td className="hidden sm:table-cell text-gray-500">{formatDate(i.due_date)}</td>
                <td className="font-medium">{formatCurrency(Number(i.total))}</td>
                <td className="font-medium">{formatCurrency(Number(i.balance_due))}</td>
                <td><span className={`badge ${statusColor(i.status)}`}>{i.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={`px-3 py-1.5 rounded-full capitalize text-sm ${active ? "bg-brand-600 text-white" : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
      {label}
    </Link>
  );
}
