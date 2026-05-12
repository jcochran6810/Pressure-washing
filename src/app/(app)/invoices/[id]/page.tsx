import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { setInvoiceStatus, recordPayment, createStripePaymentLink, deleteInvoice, saveInvoiceToDrive, emailInvoiceToCustomer } from "../actions";
import { customerDisplayName, formatCurrency, formatDate, statusColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await getSessionAndOrg();
  const { data: inv } = await supabase
    .from("invoices")
    .select("*, customers(*), invoice_line_items(*)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!inv) notFound();

  const { data: payments } = await supabase.from("payments").select("*").eq("invoice_id", id).order("payment_date", { ascending: false });

  const sortedItems = ((inv.invoice_line_items as any[]) ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const markSent = setInvoiceStatus.bind(null, inv.id, "sent");
  const markVoid = setInvoiceStatus.bind(null, inv.id, "void");
  const recordPay = recordPayment.bind(null, inv.id);
  const createLink = createStripePaymentLink.bind(null, inv.id);
  const saveDrive = saveInvoiceToDrive.bind(null, inv.id);
  const emailInv = emailInvoiceToCustomer.bind(null, inv.id);
  const del = deleteInvoice.bind(null, inv.id);

  return (
    <div>
      <Link href="/invoices" className="text-sm text-brand-600 hover:underline">← Invoices</Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mt-2 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{inv.invoice_number}</h1>
          <span className={`badge mt-1 ${statusColor(inv.status)}`}>{inv.status}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/documents/invoices/${inv.id}/pdf`} target="_blank" rel="noopener" className="btn-secondary">View / Print</a>
          <form action={emailInv}><button className="btn-secondary" disabled={!(inv.customers as any)?.email}>Email to customer</button></form>
          <form action={saveDrive}><button className="btn-secondary">Save to Drive</button></form>
          {inv.status === "draft" && <form action={markSent}><button className="btn-secondary">Mark sent</button></form>}
          {inv.stripe_payment_link ? (
            <a href={inv.stripe_payment_link} target="_blank" rel="noopener" className="btn-secondary">Stripe link ↗</a>
          ) : (
            <form action={createLink}><button className="btn-secondary">Create Stripe link</button></form>
          )}
          {inv.status !== "paid" && inv.status !== "void" && (
            <form action={markVoid}><button className="btn-ghost text-red-600">Void</button></form>
          )}
        </div>
      </div>

      <div className="card-padded mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Field label="Customer" value={customerDisplayName(inv.customers as any)} />
          <Field label="Issued" value={formatDate(inv.issue_date)} />
          <Field label="Due" value={formatDate(inv.due_date)} />
          <Field label="Balance due" value={formatCurrency(Number(inv.balance_due))} bold />
        </div>
      </div>

      <div className="card mb-4 overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Description</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {sortedItems.map((li) => (
              <tr key={li.id}>
                <td>{li.description}</td>
                <td className="text-right">{li.quantity}</td>
                <td className="text-right">{formatCurrency(Number(li.unit_price))}</td>
                <td className="text-right font-medium">{formatCurrency(Number(li.total))}</td>
              </tr>
            ))}
            <tr><td colSpan={3} className="text-right text-gray-500">Subtotal</td><td className="text-right">{formatCurrency(Number(inv.subtotal))}</td></tr>
            {Number(inv.discount_amount) > 0 && <tr><td colSpan={3} className="text-right text-gray-500">Discount</td><td className="text-right">− {formatCurrency(Number(inv.discount_amount))}</td></tr>}
            <tr><td colSpan={3} className="text-right text-gray-500">Tax ({(Number(inv.tax_rate) * 100).toFixed(2)}%)</td><td className="text-right">{formatCurrency(Number(inv.tax_amount))}</td></tr>
            <tr className="font-bold text-base"><td colSpan={3} className="text-right">Total</td><td className="text-right">{formatCurrency(Number(inv.total))}</td></tr>
            <tr><td colSpan={3} className="text-right text-gray-500">Paid</td><td className="text-right">− {formatCurrency(Number(inv.amount_paid))}</td></tr>
            <tr className="font-bold text-base text-brand-700"><td colSpan={3} className="text-right">Balance due</td><td className="text-right">{formatCurrency(Number(inv.balance_due))}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-padded">
          <h2 className="font-semibold mb-3">Record payment</h2>
          <form action={recordPay} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label>Amount</label>
                <input name="amount" type="number" step="0.01" min="0" defaultValue={Number(inv.balance_due)} className="w-full" />
              </div>
              <div>
                <label>Date</label>
                <input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label>Method</label>
                <select name="payment_method" className="w-full">
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="card">Card</option>
                  <option value="ach">ACH</option>
                  <option value="stripe">Stripe</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label>Reference #</label>
                <input name="reference_number" className="w-full" placeholder="Check #, last 4, etc." />
              </div>
            </div>
            <div>
              <label>Notes</label>
              <input name="notes" className="w-full" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="send_receipt" defaultChecked />
              <span>Email "Paid" receipt to customer</span>
            </label>
            <button className="btn-primary w-full">Record payment</button>
          </form>
        </div>

        <div className="card-padded">
          <h2 className="font-semibold mb-3">Payment history</h2>
          {!payments?.length ? <p className="text-sm text-gray-500">No payments yet.</p> : (
            <ul className="divide-y divide-gray-100">
              {payments.map((p) => (
                <li key={p.id} className="py-2 flex justify-between text-sm">
                  <div>
                    <p className="font-medium">{formatCurrency(Number(p.amount))}</p>
                    <p className="text-xs text-gray-500 capitalize">{p.payment_method} • {formatDate(p.payment_date)}</p>
                  </div>
                  {p.reference_number && <p className="text-xs text-gray-500">{p.reference_number}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <form action={del} className="mt-5">
        <button className="btn-ghost text-red-600 hover:bg-red-50 text-xs">Delete invoice</button>
      </form>
    </div>
  );
}

function Field({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={bold ? "font-bold text-lg" : "font-medium"}>{value}</p>
    </div>
  );
}
