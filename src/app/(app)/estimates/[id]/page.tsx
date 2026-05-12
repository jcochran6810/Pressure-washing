import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionAndOrg } from "@/lib/org";
import { setEstimateStatus, convertEstimateToInvoice, deleteEstimate, saveEstimateToDrive, emailEstimateToCustomer, smsEstimateToCustomer, updateEstimate } from "../actions";
import { customerDisplayName, formatCurrency, formatDate, statusColor } from "@/lib/utils";
import { documentLabel } from "@/lib/document-number";
import { PhotoUploader } from "@/components/photo-uploader";
import { PhotoGallery } from "@/components/photo-gallery";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { NextStepBanner } from "@/components/next-step-banner";
import { LineItemEditor } from "@/components/line-item-editor";
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

  const [{ data: photos }, { data: services }] = await Promise.all([
    supabase
      .from("photo_attachments")
      .select("*")
      .eq("estimate_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("services").select("id, name, default_price").eq("organization_id", organizationId).eq("active", true).order("name"),
  ]);

  const workflow = await loadWorkflow({ estimateId: id });
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null;

  // "Modified since last send": the doc has been edited after it was last
  // sent to the customer. Drives the orange "Re-send" CTA.
  const sentAt = est.sent_at ? new Date(est.sent_at) : null;
  const updatedAt = est.updated_at ? new Date(est.updated_at) : null;
  const modifiedSinceSend = !!(sentAt && updatedAt && updatedAt.getTime() - sentAt.getTime() > 1000);

  const sortedItems = ((est.estimate_line_items as any[]) ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const markSent = setEstimateStatus.bind(null, est.id, "sent");
  const markAccepted = setEstimateStatus.bind(null, est.id, "accepted");
  const markDeclined = setEstimateStatus.bind(null, est.id, "declined");
  const convert = convertEstimateToInvoice.bind(null, est.id);
  const saveDrive = saveEstimateToDrive.bind(null, est.id);
  const emailEst = emailEstimateToCustomer.bind(null, est.id);
  const smsEst = smsEstimateToCustomer.bind(null, est.id);
  const editEst = updateEstimate.bind(null, est.id);
  const del = deleteEstimate.bind(null, est.id);

  const initialItems = sortedItems.map((li: any) => ({
    description: li.description,
    quantity: Number(li.quantity ?? 1),
    unit_price: Number(li.unit_price ?? 0),
    photos: (li.photo_urls as string[]) ?? [],
  }));

  const cust: any = est.customers;
  const hasPhone = !!(cust?.mobile_phone || cust?.phone);
  const smsConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER,
  );

  return (
    <div>
      <Link href="/estimates" className="text-sm text-brand-600 hover:underline">← Estimates</Link>
      <div className="flex flex-wrap items-start justify-between gap-3 mt-2 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{documentLabel("estimate", est.status, est.estimate_number)}</h1>
          <span className={`badge mt-1 ${statusColor(est.status)}`}>{est.status}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/documents/estimates/${est.id}/pdf`} target="_blank" rel="noopener" className="btn-secondary">View / Print</a>
          <form action={emailEst}><button className="btn-secondary" disabled={!(est.customers as any)?.email}>Email to customer</button></form>
          {smsConfigured && (
            <form action={smsEst}><button className="btn-secondary" disabled={!hasPhone}>Send via SMS</button></form>
          )}
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

      {modifiedSinceSend && (
        <div className="card-padded mb-4 border-orange-300 bg-orange-50">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-orange-900">Modified since last send</p>
              <p className="text-xs text-orange-800 mt-0.5">
                You've changed this estimate since it was last sent to the customer. Re-send to give them the
                updated version.
              </p>
            </div>
            <div className="flex gap-2">
              <form action={emailEst}>
                <button className="btn-primary text-sm" disabled={!cust?.email}>✉ Re-send email</button>
              </form>
              {smsConfigured && (
                <form action={smsEst}>
                  <button className="btn-secondary text-sm" disabled={!hasPhone}>📱 Re-send SMS</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

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

      <section className="card-padded mb-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-semibold">Line items, notes &amp; terms</h2>
          <p className="text-xs text-gray-600">
            Edit anything below and click <strong>Save changes</strong>. If the estimate was already sent, a
            re-send banner will appear after saving.
          </p>
        </div>
        <form action={editEst}>
          <LineItemEditor
            services={(services as any) ?? []}
            initial={initialItems}
            taxRateInitial={Number(est.tax_rate ?? 0)}
            discountInitial={Number(est.discount_amount ?? 0)}
            organizationId={est.organization_id}
            mapsApiKey={mapsApiKey}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <label>Notes (shown to customer)</label>
              <textarea name="notes" rows={2} defaultValue={est.notes ?? ""} className="w-full" />
            </div>
            <div>
              <label>Terms (shown to customer)</label>
              <textarea name="terms" rows={2} defaultValue={est.terms ?? ""} className="w-full" />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button className="btn-primary">Save changes</button>
          </div>
        </form>
      </section>

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
