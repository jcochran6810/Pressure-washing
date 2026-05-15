import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    { data: recent },
    { data: failedEmails },
    { data: outstandingInvoices },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, payment_date, payment_method, customer_id, organization_id, organizations(name)")
      .gte("payment_date", since.slice(0, 10))
      .order("payment_date", { ascending: false })
      .limit(100),
    // Proxy for "failed payments" — emails whose subject suggests a payment
    // receipt or invoice that bounced or errored. Not perfect; the real
    // signal would be Stripe payment_intent.failed events (TODO).
    supabase
      .from("email_log")
      .select("organization_id, to_email, subject, error, sent_at, organizations(name)")
      .eq("status", "failed")
      .gte("sent_at", since)
      .order("sent_at", { ascending: false })
      .limit(50),
    supabase
      .from("invoices")
      .select("invoice_number, total, balance_due, due_date, organization_id, organizations(name)")
      .eq("status", "overdue")
      .order("due_date", { ascending: true })
      .limit(50),
  ]);

  const total = (recent ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const outstandingTotal = (outstandingInvoices ?? []).reduce((s, i) => s + Number(i.balance_due ?? 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">Payments</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Kpi label="Last 30 days" value={formatCurrency(total)} />
        <Kpi label="Payments count" value={String(recent?.length ?? 0)} />
        <Kpi label="Overdue invoices" value={String(outstandingInvoices?.length ?? 0)} tone="warn" />
        <Kpi label="Outstanding total" value={formatCurrency(outstandingTotal)} tone="warn" />
      </div>

      <section className="card mb-5 overflow-hidden">
        <header className="px-4 py-3 border-b">
          <h2 className="font-semibold">Failed messaging (last 30 days)</h2>
          <p className="text-xs text-gray-500">Receipts and reminders that didn't deliver — often signal a payment-flow problem.</p>
        </header>
        <table className="data-table">
          <thead><tr><th>When</th><th>Company</th><th>To</th><th>Subject</th><th>Error</th></tr></thead>
          <tbody>
            {(failedEmails ?? []).map((e: any, i: number) => (
              <tr key={i}>
                <td className="text-xs">{formatDate(e.sent_at)}</td>
                <td><Link href={`/admin/companies/${e.organization_id}`} className="text-brand-700 hover:underline">{e.organizations?.name}</Link></td>
                <td className="text-xs">{e.to_email}</td>
                <td className="text-xs max-w-[260px] truncate">{e.subject}</td>
                <td className="text-xs text-red-600 max-w-[260px] truncate">{e.error}</td>
              </tr>
            ))}
            {(failedEmails ?? []).length === 0 && (
              <tr><td colSpan={5} className="text-center text-gray-500 py-6">No failed emails in window.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card mb-5 overflow-hidden">
        <header className="px-4 py-3 border-b"><h2 className="font-semibold">Overdue invoices across all orgs</h2></header>
        <table className="data-table">
          <thead><tr><th>Company</th><th>Invoice</th><th>Due</th><th className="text-right">Balance</th></tr></thead>
          <tbody>
            {(outstandingInvoices ?? []).map((i: any, k: number) => (
              <tr key={k}>
                <td><Link href={`/admin/companies/${i.organization_id}`} className="text-brand-700 hover:underline">{i.organizations?.name}</Link></td>
                <td>{i.invoice_number}</td>
                <td className="text-xs">{i.due_date ? formatDate(i.due_date) : "—"}</td>
                <td className="text-right">{formatCurrency(Number(i.balance_due ?? 0))}</td>
              </tr>
            ))}
            {(outstandingInvoices ?? []).length === 0 && (
              <tr><td colSpan={4} className="text-center text-gray-500 py-6">No overdue invoices.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card overflow-hidden">
        <header className="px-4 py-3 border-b"><h2 className="font-semibold">Recent payments (last 30 days)</h2></header>
        <table className="data-table">
          <thead><tr><th>Date</th><th>Company</th><th>Method</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {(recent ?? []).map((p: any, i: number) => (
              <tr key={i}>
                <td className="text-xs">{p.payment_date ? formatDate(p.payment_date) : "—"}</td>
                <td><Link href={`/admin/companies/${p.organization_id}`} className="text-brand-700 hover:underline">{p.organizations?.name}</Link></td>
                <td className="text-xs capitalize">{p.payment_method}</td>
                <td className="text-right">{formatCurrency(Number(p.amount ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" | "ok" }) {
  return (
    <div className="card-padded">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-green-700" : ""}`}>{value}</p>
    </div>
  );
}
