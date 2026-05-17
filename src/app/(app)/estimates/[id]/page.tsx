import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { setEstimateStatus, convertEstimateToInvoice, deleteEstimate, saveEstimateToDrive, emailEstimateToCustomer, sendEstimateViaTemplate } from "../actions";
import { customerDisplayName, formatCurrency, formatDate, statusColor } from "@/lib/utils";
import { PhotoUploader } from "@/components/photo-uploader";
import { PhotoGallery } from "@/components/photo-gallery";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { NextStepBanner } from "@/components/next-step-banner";
import { loadWorkflow } from "@/lib/workflow";

export const dynamic = "force-dynamic";

export default async function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, organizationId } = await getSessionAndOrg();

  const { data: est } = await supabase
    .from("estimates")
    .select("*, customers(*), properties(*), estimate_line_items(*)")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .single();
  if (!est) notFound();

  const { data: photos } = await supabase
    .from("photo_attachments")
    .select("*")
    .eq("estimate_id", id)
    .order("created_at", { ascending: false });

  const workflow = await loadWorkflow({ estimateId: id });

  const sortedItems = ((est.estimate_line_items as any[]) ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const markSent = setEstimateStatus.bind(null, est.id, "sent");
  const markAccepted = setEstimateStatus.bind(null, est.id, "accepted");
  const markDeclined = setEstimateStatus.bind(null, est.id, "declined");
  const convert = convertEstimateToInvoice.bind(null, est.id);
  const saveDrive = saveEstimateToDrive.bind(null, est.id);
  const emailEst = emailEstimateToCustomer.bind(null, est.id);
  const emailTpl = sendEstimateViaTemplate.bind(null, est.id, "email");
  const smsTpl = sendEstimateViaTemplate.bind(null, est.id, "sms");
  const del = deleteEstimate.bind(null, est.id);
  const cust: any = est.customers;
  const hasEmail = !!cust?.email;
  const hasPhone = !!(cust?.phone || cust?.mobile_phone);

  return (
    <div>
      <Link href="/estimates" className="text-sm text-brand-600 hover:underline">← Estimates</Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mt-2 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{est.estimate_number}</h1>
          <span className={`badge mt-1 ${statusColor(est.status)}`}>{est.status}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/documents/estimates/${est.id}/html`} target="_blank" rel="noopener" className="btn-secondary">View / Print</a>
          {est.status !== "converted" && est.status !== "accepted" && (
            <Link href={`/estimates/${est.id}/edit`} className="btn-secondary">Edit</Link>
          )}
          <form action={emailEst}><button className="btn-secondary" disabled={!hasEmail}>Email estimate</button></form>
          <form action={emailTpl}><button className="btn-secondary" disabled={!hasEmail}>Send email template</button></form>
          <form action={smsTpl}><button className="btn-secondary" disabled={!hasPhone}>Send SMS</button></form>
          <form action={saveDrive}><button className="btn-secondary">Save to Drive</button></form>
          {est.status === "draft" && <form action={markSent}><button className="btn-secondary">Mark sent</button></form>}
          {(est.status === "sent" || est.status === "draft") && <form action={markAccepted}><button className="btn-secondary">Mark accepted</button></form>}
          {(est.status === "sent" || est.status === "draft") && <form action={markDeclined}><button className="btn-ghost">Mark declined</button></form>}
          {est.status !== "converted" && <form action={convert}><button className="btn-primary">Convert to invoice →</button></form>}
        </div>
      </div>

      <WorkflowStepper workflow={workflow} />
      <NextStepBanner
        workflow={workflow}
        approvalToken={est.approval_token}
        customerHasEmail={!!(est.customers as any)?.email}
      />

      <div className="card-padded mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Field label="Customer" value={customerDisplayName(est.customers as any)} />
          <Field label="Issued" value={formatDate(est.issue_date)} />
          <Field label="Expires (30 day default)" value={formatDate(est.expires_at)} />
          <Field label="Total" value={formatCurrency(Number(est.total))} bold />
        </div>
        {est.deposit_amount && (
          <p className="mt-3 text-sm text-amber-700">
            Deposit on approval: <strong>{formatCurrency(Number(est.deposit_amount))}</strong>
          </p>
        )}
        {est.prepared_by && (
          <p className="mt-1 text-xs text-gray-500">Prepared by {est.prepared_by}</p>
        )}
        {est.duration_minutes && (
          <p className="mt-1 text-xs text-gray-500">
            Internal: estimated {est.duration_minutes}m{est.buffer_minutes ? ` + ${est.buffer_minutes}m buffer` : ""}
          </p>
        )}
        {est.approval_token && (
          <div className="mt-3 p-2 bg-brand-50 border border-brand-200 rounded-md text-xs">
            <span className="font-semibold text-brand-900">Customer approval link:</span>{" "}
            <a href={`/quote/${est.approval_token}`} target="_blank" rel="noopener" className="text-brand-700 underline break-all">{`${process.env.NEXT_PUBLIC_APP_URL || ""}/quote/${est.approval_token}`}</a>
          </div>
        )}
        {est.declined_reason && (
          <p className="mt-2 text-sm text-red-700">Declined reason: {est.declined_reason}</p>
        )}
      </div>

      <div className="card mb-4">
        <table className="data-table">
          <thead><tr><th>Description</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {sortedItems.map((li) => (
              <tr key={li.id}>
                <td>
                  <div>{li.description}</div>
                  {!!li.photo_urls?.length && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {li.photo_urls.map((u: string) => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <a key={u} href={u} target="_blank" rel="noopener"><img src={u} alt="" className="w-12 h-12 object-cover rounded border border-gray-200" /></a>
                      ))}
                    </div>
                  )}
                </td>
                <td className="text-right">{li.quantity}</td>
                <td className="text-right">{formatCurrency(Number(li.unit_price))}</td>
                <td className="text-right font-medium">{formatCurrency(Number(li.total))}</td>
              </tr>
            ))}
            <tr><td colSpan={3} className="text-right text-gray-500">Subtotal</td><td className="text-right">{formatCurrency(Number(est.subtotal))}</td></tr>
            {Number(est.discount_amount) > 0 && <tr><td colSpan={3} className="text-right text-gray-500">Discount</td><td className="text-right">− {formatCurrency(Number(est.discount_amount))}</td></tr>}
            <tr><td colSpan={3} className="text-right text-gray-500">Tax ({(Number(est.tax_rate) * 100).toFixed(2)}%)</td><td className="text-right">{formatCurrency(Number(est.tax_amount))}</td></tr>
            <tr className="font-bold text-base"><td colSpan={3} className="text-right">Total</td><td className="text-right">{formatCurrency(Number(est.total))}</td></tr>
          </tbody>
        </table>
      </div>

      {(est.notes || est.terms) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {est.notes && <div className="card-padded"><h3 className="font-semibold mb-1">Notes</h3><p className="text-sm whitespace-pre-wrap text-gray-700">{est.notes}</p></div>}
          {est.terms && <div className="card-padded"><h3 className="font-semibold mb-1">Terms</h3><p className="text-sm whitespace-pre-wrap text-gray-700">{est.terms}</p></div>}
        </div>
      )}

      <section className="card-padded mt-4">
        <h2 className="font-semibold mb-3">Photos (before / damage)</h2>
        <PhotoUploader
          organizationId={est.organization_id}
          targetType="estimate"
          targetId={est.id}
          customerId={est.customer_id}
          kind="before"
        />
        <div className="mt-3">
          <PhotoGallery photos={photos ?? []} />
        </div>
      </section>

      <form action={del} className="mt-5">
        <button className="btn-ghost text-red-600 hover:bg-red-50 text-xs">Delete estimate</button>
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
