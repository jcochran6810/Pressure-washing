import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { customerDisplayName, formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data } = await supabase
    .from("payments")
    .select("id, amount, payment_method, payment_date, reference_number, customers(first_name, last_name, company_name), invoices(id, invoice_number)")
    .eq("organization_id", organizationId)
    .order("payment_date", { ascending: false });

  const total = (data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);

  if (!data?.length) {
    return (
      <div>
        <PageHeader title="Payments" description="All payments received." />
        <EmptyState title="No payments yet" description="Record payments from individual invoices." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Payments" description={`${data.length} payments • ${formatCurrency(total)} collected`} />
      <div className="table-wrap overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr><th>Date</th><th>Customer</th><th>Invoice</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr>
          </thead>
          <tbody>
            {data.map((p: any) => (
              <tr key={p.id}>
                <td>{formatDate(p.payment_date)}</td>
                <td>{customerDisplayName(p.customers ?? {})}</td>
                <td>{p.invoices ? <Link href={`/invoices/${p.invoices.id}`} className="hover:text-brand-700">{p.invoices.invoice_number}</Link> : "—"}</td>
                <td className="capitalize">{p.payment_method}</td>
                <td className="text-gray-600">{p.reference_number || "—"}</td>
                <td className="text-right font-medium">{formatCurrency(Number(p.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
