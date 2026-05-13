import { getSessionAndOrg } from "@/lib/org";
import { PageHeader, EmptyState } from "@/components/page-header";
import { formatCurrency } from "@/lib/utils";
import { PaymentsList, type PaymentRow } from "./payments-list";

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
        <PageHeader title="Receipts" description="Payments received — emailed receipts and Drive copies." />
        <EmptyState title="No receipts yet" description="Record payments from individual invoices." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Receipts" description={`${data.length} receipts • ${formatCurrency(total)} collected`} />
      <PaymentsList rows={data as unknown as PaymentRow[]} />
    </div>
  );
}
