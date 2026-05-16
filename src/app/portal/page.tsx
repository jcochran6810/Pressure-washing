import Link from "next/link";
import { getPortalSession } from "@/lib/portal";
import { formatCurrency, formatDate, customerDisplayName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortalDashboard() {
  const { supabase, customer, organization } = await getPortalSession();

  const [{ data: invoices }, { data: estimates }, { data: jobs }, { data: payments }] = await Promise.all([
    supabase.from("invoices")
      .select("id, invoice_number, status, total, balance_due, issue_date, due_date, stripe_payment_link")
      .eq("customer_id", customer.id)
      .order("issue_date", { ascending: false })
      .limit(20),
    supabase.from("estimates")
      .select("id, estimate_number, status, total, issue_date, expires_at, approval_token")
      .eq("customer_id", customer.id)
      .order("issue_date", { ascending: false })
      .limit(10),
    supabase.from("jobs")
      .select("id, title, status, scheduled_start, total_amount")
      .eq("customer_id", customer.id)
      .order("scheduled_start", { ascending: false, nullsFirst: false })
      .limit(10),
    supabase.from("payments")
      .select("amount, payment_date, payment_method")
      .eq("customer_id", customer.id)
      .order("payment_date", { ascending: false })
      .limit(20),
  ]);

  const outstandingTotal = (invoices ?? [])
    .filter((i: any) => i.status !== "paid" && i.status !== "void")
    .reduce((s: number, i: any) => s + Number(i.balance_due ?? 0), 0);
  const lifetimePaid = (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const openInvoices = (invoices ?? []).filter((i: any) => i.status !== "paid" && i.status !== "void");

  return (
    <div>
      <div className="mb-5">
        <p className="text-sm text-gray-500">Hi {customer.first_name || customer.company_name || "there"} 👋</p>
        <h1 className="text-2xl sm:text-3xl font-bold">{organization.name}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="card-padded">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Outstanding balance</p>
          <p className="text-2xl font-bold text-brand-700">{formatCurrency(outstandingTotal, organization.currency)}</p>
        </div>
        <div className="card-padded">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Lifetime paid</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(lifetimePaid, organization.currency)}</p>
        </div>
        <div className="card-padded">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Open invoices</p>
          <p className="text-2xl font-bold">{openInvoices.length}</p>
        </div>
      </div>

      {openInvoices.length > 0 && (
        <section className="card-padded mb-5">
          <h2 className="font-semibold mb-3">Pay open invoices</h2>
          <ul className="divide-y divide-gray-100">
            {openInvoices.map((inv: any) => (
              <li key={inv.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-gray-500">Due {formatDate(inv.due_date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-medium">{formatCurrency(Number(inv.balance_due), organization.currency)}</p>
                  {inv.stripe_payment_link ? (
                    <a href={inv.stripe_payment_link} target="_blank" rel="noopener" className="btn-primary text-xs">Pay online</a>
                  ) : (
                    <span className="text-xs text-gray-400">contact us to pay</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card-padded mb-5">
        <h2 className="font-semibold mb-3">Invoices</h2>
        {!invoices?.length ? <p className="text-sm text-gray-500">No invoices yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Invoice</th><th>Status</th><th>Date</th><th className="text-right">Total</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              {invoices.map((inv: any) => (
                <tr key={inv.id}>
                  <td className="font-medium">{inv.invoice_number}</td>
                  <td><span className="badge bg-gray-100 text-gray-700 capitalize">{inv.status}</span></td>
                  <td className="text-sm">{formatDate(inv.issue_date)}</td>
                  <td className="text-right">{formatCurrency(Number(inv.total), organization.currency)}</td>
                  <td className="text-right font-medium">{formatCurrency(Number(inv.balance_due ?? 0), organization.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {!!estimates?.length && (
        <section className="card-padded mb-5">
          <h2 className="font-semibold mb-3">Estimates</h2>
          <table className="data-table">
            <thead><tr><th>Estimate</th><th>Status</th><th>Issued</th><th className="text-right">Total</th><th>Action</th></tr></thead>
            <tbody>
              {estimates.map((est: any) => (
                <tr key={est.id}>
                  <td className="font-medium">{est.estimate_number}</td>
                  <td><span className="badge bg-gray-100 text-gray-700 capitalize">{est.status}</span></td>
                  <td className="text-sm">{formatDate(est.issue_date)}</td>
                  <td className="text-right">{formatCurrency(Number(est.total), organization.currency)}</td>
                  <td>
                    {est.approval_token && (est.status === "draft" || est.status === "sent") && (
                      <Link href={`/quote/${est.approval_token}`} className="text-xs text-brand-600 hover:underline">Review / approve</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {!!jobs?.length && (
        <section className="card-padded mb-5">
          <h2 className="font-semibold mb-3">Service history</h2>
          <ul className="divide-y divide-gray-100">
            {jobs.map((job: any) => (
              <li key={job.id} className="py-2 flex justify-between text-sm">
                <div>
                  <p className="font-medium">{job.title}</p>
                  <p className="text-xs text-gray-500">{job.scheduled_start ? formatDate(job.scheduled_start) : "Not scheduled"}</p>
                </div>
                <span className="badge bg-gray-100 text-gray-700 capitalize">{job.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-gray-500 text-center mt-6">
        Questions? Reach out to <strong>{organization.name}</strong>
        {organization.email && <> at <a href={`mailto:${organization.email}`} className="text-brand-600">{organization.email}</a></>}
        {organization.phone && <> · {organization.phone}</>}.
      </p>
    </div>
  );
}
