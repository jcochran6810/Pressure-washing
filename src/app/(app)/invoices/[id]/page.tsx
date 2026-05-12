import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { setInvoiceStatus, recordPayment, createStripePaymentLink, deleteInvoice, saveInvoiceToDrive, emailInvoiceToCustomer, updateInvoice, smsInvoiceToCustomer, sendReceiptToCustomer } from "../actions";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { NextStepBanner } from "@/components/next-step-banner";
import { CardChargeForm } from "@/components/card-charge-form";
import { LineItemEditor } from "@/components/line-item-editor";
import { PhotoUploader } from "@/components/photo-uploader";
import { PhotoGallery } from "@/components/photo-gallery";
import { loadWorkflow } from "@/lib/workflow";
import { customerDisplayName, formatCurrency, formatDate, statusColor } from "@/lib/utils";
import { documentLabel } from "@/lib/document-number";

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

  // Invoices/receipts can be edited in any status (draft, sent, partial,
  // paid, overdue). Receipts (status=paid) preserve recorded payment amounts;
  // only totals and metadata change.
  const isDraft = inv.status === "draft";
  const isReceipt = inv.status === "paid";
  const [{ data: services }, { data: invoicePhotos }, { data: lastReceiptRow }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, default_price")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("photo_attachments")
      .select("*")
      .eq("invoice_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("receipt_log")
      .select("sent_at")
      .eq("invoice_id", id)
      .eq("organization_id", organizationId)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;

  // "Modified since last send": drives the orange Re-send banner.
  const sentAt = inv.sent_at ? new Date(inv.sent_at) : null;
  const updatedAt = inv.updated_at ? new Date(inv.updated_at) : null;
  const receiptSentAt = lastReceiptRow?.sent_at ? new Date(lastReceiptRow.sent_at) : null;
  // For receipts, compare against the latest receipt_log entry; for everything
  // else, compare against the invoice's sent_at.
  const compareAgainst = isReceipt ? receiptSentAt : sentAt;
  const modifiedSinceSend = !!(compareAgainst && updatedAt && updatedAt.getTime() - compareAgainst.getTime() > 1000);

  const workflow = await loadWorkflow({ invoiceId: id });

  const sortedItems = ((inv.invoice_line_items as any[]) ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const markSent = setInvoiceStatus.bind(null, inv.id, "sent");
  const markVoid = setInvoiceStatus.bind(null, inv.id, "void");
  const recordPay = recordPayment.bind(null, inv.id);
  const createLink = createStripePaymentLink.bind(null, inv.id);
  const saveDrive = saveInvoiceToDrive.bind(null, inv.id);
  const emailInv = emailInvoiceToCustomer.bind(null, inv.id);
  const del = deleteInvoice.bind(null, inv.id);
  const editInv = updateInvoice.bind(null, inv.id);
  const smsInv = smsInvoiceToCustomer.bind(null, inv.id);
  const reSendReceipt = sendReceiptToCustomer.bind(null, inv.id);
  const invCust: any = inv.customers;
  const invHasPhone = !!(invCust?.mobile_phone || invCust?.phone);
  const smsConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER,
  );

  const initialItems = sortedItems.map((li: any) => ({
    description: li.description,
    quantity: Number(li.quantity ?? 1),
    unit_price: Number(li.unit_price ?? 0),
    photos: (li.photo_urls as string[]) ?? [],
  }));

  return (
    <div>
      <Link href="/invoices" className="text-sm text-brand-600 hover:underline">← Invoices</Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mt-2 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{documentLabel("invoice", inv.status, inv.invoice_number)}</h1>
          <span className={`badge mt-1 ${statusColor(inv.status)}`}>{inv.status}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/documents/invoices/${inv.id}/pdf`} target="_blank" rel="noopener" className="btn-secondary">View PDF</a>
          <a href={`/api/documents/invoices/${inv.id}/pdf?download=1`} className="btn-secondary">Download PDF</a>
          <form action={emailInv}><button className="btn-secondary" disabled={!(inv.customers as any)?.email}>Email to customer</button></form>
          {smsConfigured && (
            <form action={smsInv}><button className="btn-secondary" disabled={!invHasPhone}>Send via SMS</button></form>
          )}
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

      <WorkflowStepper workflow={workflow} />
      <NextStepBanner
        workflow={workflow}
        customerHasEmail={!!(inv.customers as any)?.email}
      />

      {modifiedSinceSend && (
        <div className="card-padded mb-4 border-orange-300 bg-orange-50">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-orange-900">
                {isReceipt ? "Receipt modified since last sent" : "Invoice modified since last sent"}
              </p>
              <p className="text-xs text-orange-800 mt-0.5">
                You've changed this {isReceipt ? "receipt" : "invoice"} since it was last sent to the customer.
                Re-send so they have the updated copy.
              </p>
            </div>
            <div className="flex gap-2">
              {isReceipt ? (
                <form action={reSendReceipt}>
                  <button className="btn-primary text-sm" disabled={!invCust?.email}>✉ Re-send receipt</button>
                </form>
              ) : (
                <form action={emailInv}>
                  <button className="btn-primary text-sm" disabled={!invCust?.email}>✉ Re-send invoice</button>
                </form>
              )}
              {smsConfigured && (
                <form action={smsInv}>
                  <button className="btn-secondary text-sm" disabled={!invHasPhone}>📱 Re-send SMS</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card-padded mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Field label="Customer" value={customerDisplayName(inv.customers as any)} />
          <Field label="Issued" value={formatDate(inv.issue_date)} />
          <Field label="Due" value={formatDate(inv.due_date)} />
          <Field label="Balance due" value={formatCurrency(Number(inv.balance_due))} bold />
        </div>
      </div>

      <section className={`card-padded mb-4 ${isDraft ? "border-amber-300 ring-1 ring-amber-100" : ""}`}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="font-semibold">
              {isDraft ? "Review & edit before sending" : isReceipt ? "Edit receipt" : "Edit invoice"}
            </h2>
            <p className="text-xs text-gray-600">
              {isDraft
                ? "This invoice is in draft. Edit anything below — the customer hasn't seen it yet."
                : isReceipt
                  ? "Editing a paid receipt preserves the recorded payment amount. After saving, a Re-send button will appear so you can deliver the updated copy."
                  : "After saving any change, a Re-send button will appear so you can deliver the updated copy to the customer."}
            </p>
          </div>
        </div>
        <form action={editInv}>
          <LineItemEditor
            services={(services as any) ?? []}
            initial={initialItems}
            taxRateInitial={Number(inv.tax_rate ?? 0)}
            discountInitial={Number(inv.discount_amount ?? 0)}
            organizationId={inv.organization_id}
            mapsApiKey={mapsApiKey}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label>Notes (shown to customer)</label>
              <textarea name="notes" rows={2} defaultValue={inv.notes ?? ""} className="w-full" />
            </div>
            <div>
              <label>Terms (shown to customer)</label>
              <textarea name="terms" rows={2} defaultValue={inv.terms ?? ""} className="w-full" />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button className="btn-primary">Save changes</button>
          </div>
        </form>
      </section>

      <section className="card-padded mb-4">
          <h2 className="font-semibold mb-2">Invoice photos</h2>
          <p className="text-xs text-gray-600 mb-3">
            Photos here are attached to the invoice itself (e.g. final after-work shots) and visible alongside the line
            items. Use the line-item editor above to attach photos to a specific charge.
          </p>
          <PhotoUploader
            organizationId={inv.organization_id}
            targetType="invoice"
            targetId={inv.id}
            customerId={inv.customer_id}
            kind="after"
          />
          <div className="mt-3">
            <PhotoGallery photos={(invoicePhotos as any) ?? []} />
          </div>
        </section>

      {inv.status !== "paid" && inv.status !== "void" && Number(inv.balance_due) > 0 && (
        <div className="card-padded mb-4 border-brand-300 ring-1 ring-brand-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Charge a card now (virtual terminal)</h2>
            <span className="text-xs text-gray-500">Type the customer's card here</span>
          </div>
          <CardChargeForm invoiceId={inv.id} defaultAmount={Number(inv.balance_due)} />
        </div>
      )}

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
