// Customer self-serve portal — public, token-gated via customers.portal_token.
// Shows estimates the customer can sign, invoices they can pay online, and
// recent job history. The token is emailed alongside estimate/invoice copies
// (see PORTAL_URL helper).

import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { formatCurrency, formatDate, customerDisplayName, statusColor } from "@/lib/utils";
import { PLATFORM_NAME } from "@/lib/platform";

export const dynamic = "force-dynamic";

function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export default async function CustomerPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = publicClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name, email, phone, organization_id, organizations(name, logo_url, phone, email, website)")
    .eq("portal_token", token)
    .maybeSingle();

  if (!customer) {
    return (
      <main className="min-h-screen grid place-items-center p-6 bg-gray-50">
        <div className="card-padded max-w-md text-center">
          <h1 className="text-xl font-bold">Link expired</h1>
          <p className="text-gray-600 mt-2">This portal link is invalid or expired. Please contact us for a new one.</p>
        </div>
      </main>
    );
  }

  const org = customer.organizations as any;

  const [{ data: estimates }, { data: invoices }, { data: jobs }] = await Promise.all([
    supabase
      .from("estimates")
      .select("id, estimate_number, status, issue_date, expires_at, total, deposit_amount, deposit_paid, approval_token")
      .eq("customer_id", customer.id)
      .order("issue_date", { ascending: false })
      .limit(20),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, issue_date, due_date, total, amount_paid, balance_due, stripe_payment_link")
      .eq("customer_id", customer.id)
      .order("issue_date", { ascending: false })
      .limit(20),
    supabase
      .from("jobs")
      .select("id, title, status, scheduled_start, scheduled_end")
      .eq("customer_id", customer.id)
      .order("scheduled_start", { ascending: false })
      .limit(15),
  ]);

  const openInvoices = (invoices ?? []).filter((i) => (i.status === "sent" || i.status === "partial" || i.status === "overdue"));
  const paidInvoices = (invoices ?? []).filter((i) => i.status === "paid");
  const totalOpen = openInvoices.reduce((s, i) => s + Number(i.balance_due ?? 0), 0);

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="card-padded mb-5 flex items-center gap-4 flex-wrap">
          {org?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={org.name} className="h-12 max-w-[160px] object-contain" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">{org?.name}</h1>
            <p className="text-xs text-gray-500">
              {[org?.phone, org?.email].filter(Boolean).join(" • ")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Account</p>
            <p className="font-medium">{customerDisplayName(customer as any)}</p>
          </div>
        </header>

        {/* Balance summary */}
        {totalOpen > 0 && (
          <section className="card-padded mb-5 bg-amber-50 border-amber-200">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-semibold text-amber-900">Balance due</h2>
                <p className="text-2xl font-bold text-amber-900">{formatCurrency(totalOpen)}</p>
                <p className="text-xs text-amber-800">{openInvoices.length} open invoice{openInvoices.length === 1 ? "" : "s"}</p>
              </div>
            </div>
          </section>
        )}

        {/* Estimates */}
        {(estimates?.length ?? 0) > 0 && (
          <section className="card-padded mb-5">
            <h2 className="font-semibold mb-3">Estimates</h2>
            <ul className="divide-y divide-gray-100">
              {estimates!.map((e) => (
                <li key={e.id} className="py-3 flex justify-between items-center flex-wrap gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{e.estimate_number} <span className={`badge ${statusColor(e.status)}`}>{e.status}</span></p>
                    <p className="text-xs text-gray-500">Issued {formatDate(e.issue_date)} · Total {formatCurrency(Number(e.total))}</p>
                  </div>
                  {e.approval_token && e.status !== "accepted" && e.status !== "declined" && (
                    <Link href={`/quote/${e.approval_token}`} className="btn-secondary text-xs">Review & sign →</Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Open invoices — pay online */}
        {openInvoices.length > 0 && (
          <section className="card-padded mb-5">
            <h2 className="font-semibold mb-3">Invoices to pay</h2>
            <ul className="divide-y divide-gray-100">
              {openInvoices.map((i) => (
                <li key={i.id} className="py-3 flex justify-between items-center flex-wrap gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{i.invoice_number} <span className={`badge ${statusColor(i.status)}`}>{i.status}</span></p>
                    <p className="text-xs text-gray-500">Due {formatDate(i.due_date)} · Balance {formatCurrency(Number(i.balance_due))}</p>
                  </div>
                  {i.stripe_payment_link ? (
                    <a href={i.stripe_payment_link} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs">Pay {formatCurrency(Number(i.balance_due))} →</a>
                  ) : (
                    <span className="text-xs text-gray-400">Online payment unavailable — contact us.</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Job history */}
        {(jobs?.length ?? 0) > 0 && (
          <section className="card-padded mb-5">
            <h2 className="font-semibold mb-3">Recent service history</h2>
            <ul className="divide-y divide-gray-100">
              {jobs!.map((j) => (
                <li key={j.id} className="py-3 flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <p className="font-medium">{j.title}</p>
                    <p className="text-xs text-gray-500">
                      {j.scheduled_start ? formatDate(j.scheduled_start) : "Unscheduled"} · {j.status}
                    </p>
                  </div>
                  <span className={`badge ${statusColor(j.status)}`}>{j.status}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Paid invoices (receipts) */}
        {paidInvoices.length > 0 && (
          <section className="card-padded mb-5">
            <h2 className="font-semibold mb-3">Paid receipts</h2>
            <ul className="divide-y divide-gray-100 text-sm">
              {paidInvoices.map((i) => (
                <li key={i.id} className="py-2 flex justify-between">
                  <span>{i.invoice_number}</span>
                  <span className="text-gray-500">{formatDate(i.issue_date)} · {formatCurrency(Number(i.total))}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(estimates?.length ?? 0) === 0 && (invoices?.length ?? 0) === 0 && (jobs?.length ?? 0) === 0 && (
          <section className="card-padded text-center text-gray-500">
            <p>No estimates or invoices yet. New documents will show up here when we send them.</p>
          </section>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">Powered by {PLATFORM_NAME}</p>
      </div>
    </main>
  );
}
